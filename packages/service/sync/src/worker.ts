/// <reference lib="webworker" />
declare const self: Worker;

import { SourceType, SyncMessageType, type UserSyncItem } from "@contfu/core";
import { claimJobs } from "@contfu/svc-backend/features/sync-jobs/claimJobs";
import { completeJob } from "@contfu/svc-backend/features/sync-jobs/completeJob";
import { failJob } from "@contfu/svc-backend/features/sync-jobs/failJob";
import { getJobConfig } from "@contfu/svc-backend/features/sync-jobs/getJobConfig";
import { sourceCollectionTable } from "@contfu/svc-backend/infra/db/schema";
import { and, eq } from "drizzle-orm";
import { combineLatest, defer, repeat, timer } from "rxjs";
import { workerDb } from "./db/worker-db";
import { NotionSource } from "./sources/notion";
import { StrapiSource } from "./sources/strapi";
import { SortedSet } from "./util/structures/sorted-set";
import { WebSource } from "./sources/web";
import { ITEM_ID_SIZE } from "./util/ids/ids";

// Constants
const MAX_COLLECTION_PULL_SIZE = Number(process.env.MAX_COLLECTION_PULL_SIZE ?? 10_000);
const MIN_FETCH_INTERVAL = Number(process.env.MIN_FETCH_INTERVAL ?? 10_000);

// Worker identity
const workerId = crypto.randomUUID();

// Sources
const notionSource = new NotionSource();
const strapiSource = new StrapiSource();
const webSource = new WebSource();

// Handle messages from the app
self.onmessage = (e: MessageEvent) => {
  if (e.data.type === SyncMessageType.SHUTDOWN) {
    process.exit(0);
  }
};

// Job-based sync loop
async function syncLoop() {
  const jobs = await claimJobs(workerDb, workerId, MAX_COLLECTION_PULL_SIZE);
  if (jobs.length === 0) return;

  for (const job of jobs) {
    try {
      const config = await getJobConfig(workerDb, job);
      if (!config) {
        await failJob(workerDb, job.id, "Source collection config not found");
        continue;
      }

      // Dispatch to appropriate source adapter
      const fetchedItems: UserSyncItem[] = [];

      if (config.sourceType === SourceType.NOTION) {
        const opts = {
          collection: config.collectionId,
          ref: config.collectionRef!,
          credentials: config.credentials?.toString("utf-8") ?? "",
        };
        for await (const item of notionSource.fetch(opts)) {
          fetchedItems.push({ ...item, user: job.userId });
        }
      } else if (config.sourceType === SourceType.STRAPI) {
        const opts = {
          collection: config.collectionId,
          ref: config.collectionRef!,
          url: config.sourceUrl!,
          credentials: config.credentials!,
        };
        for await (const item of strapiSource.fetch(opts)) {
          fetchedItems.push({ ...item, user: job.userId });
        }
      } else {
        const opts = {
          collection: config.collectionId,
          ref: config.collectionRef!,
          url: config.sourceUrl!,
          credentials: config.credentials ?? undefined,
        };
        for await (const item of webSource.fetch(opts)) {
          fetchedItems.push({ ...item, user: job.userId });
        }
      }

      // Post items to main thread for SSE broadcast
      if (fetchedItems.length > 0) {
        self.postMessage({
          type: SyncMessageType.ITEMS_FETCHED,
          items: fetchedItems,
          userId: job.userId,
          sourceCollectionId: job.sourceCollectionId,
        });
      }

      // Update item IDs in source_collection directly
      if (fetchedItems.length > 0) {
        await updateItemIds(
          job.userId,
          job.sourceCollectionId,
          fetchedItems.map((i) => i.id),
        );
      }

      await completeJob(workerDb, job.id);
    } catch (error) {
      await failJob(workerDb, job.id, String(error));
    }
  }
}

// Item ID management (direct DB access, moved from worker-manager.ts)

function deserializeIds(ids: Buffer): Buffer[] {
  const count = ids.length / ITEM_ID_SIZE;
  // oxlint-disable-next-line unicorn/no-new-array
  const result = new Array<Buffer>(count);
  for (let i = 0; i < count; i++) {
    const idx = i * ITEM_ID_SIZE;
    result[i] = ids.subarray(idx, idx + ITEM_ID_SIZE);
  }
  return result;
}

async function updateItemIds(userId: number, sourceCollectionId: number, newIds: Buffer[]) {
  const [row] = await workerDb
    .select({ itemIds: sourceCollectionTable.itemIds })
    .from(sourceCollectionTable)
    .where(
      and(
        eq(sourceCollectionTable.userId, userId),
        eq(sourceCollectionTable.id, sourceCollectionId),
      ),
    );

  const existingIds = row?.itemIds ? deserializeIds(row.itemIds as Buffer) : [];

  const ids = new SortedSet<Buffer>({
    seed: existingIds,
    isSorted: true,
    compare: (a: Buffer, b: Buffer) => a.compare(b),
  });

  for (const id of newIds) ids.add(id);

  await workerDb
    .update(sourceCollectionTable)
    .set({ itemIds: Buffer.concat(ids as unknown as Uint8Array[]) })
    .where(
      and(
        eq(sourceCollectionTable.userId, userId),
        eq(sourceCollectionTable.id, sourceCollectionId),
      ),
    );
}

// RxJS sync loop with MIN_FETCH_INTERVAL between iterations
const sync$ = defer(() => combineLatest([timer(MIN_FETCH_INTERVAL), syncLoop()])).pipe(repeat());

sync$.subscribe({
  error: (err) => console.error("Sync error:", err),
});

// Signal ready
self.postMessage({ type: SyncMessageType.WORKER_READY });
