/// <reference lib="webworker" />
declare const self: Worker;

import { SourceType } from "@contfu/core";
import { createLogger, LoggerLive } from "@contfu/svc-backend/infra/logger/index";
import { claimJobs } from "@contfu/svc-backend/features/sync-jobs/claimJobs";
import { completeJob } from "@contfu/svc-backend/features/sync-jobs/completeJob";
import { failJob } from "@contfu/svc-backend/features/sync-jobs/failJob";
import { getJobConfig } from "@contfu/svc-backend/features/sync-jobs/getJobConfig";
import { sourceCollectionTable } from "@contfu/svc-backend/infra/db/schema";
import { getItemRefForSource } from "@contfu/svc-backend/infra/refs/encode-ref";
import { SyncMessageType, type UserSyncItem } from "@contfu/svc-backend/infra/sync-worker/messages";
import { ITEM_ID_SIZE } from "@contfu/svc-sources";
import { NotionSource } from "@contfu/svc-sources/notion";
import { StrapiSource } from "@contfu/svc-sources/strapi";
import { WebSource } from "@contfu/svc-sources/web";
import { ContentfulSource } from "@contfu/svc-sources/contentful";
import { Duration, Effect, Schedule } from "effect";
import { eq } from "drizzle-orm";
import { workerDb } from "./db/worker-db";
import { SortedSet } from "./util/structures/sorted-set";

const log = createLogger("sync-worker");

// Constants
const MAX_COLLECTION_PULL_SIZE = Number(process.env.MAX_COLLECTION_PULL_SIZE ?? 10_000);
const MIN_FETCH_INTERVAL = Number(process.env.MIN_FETCH_INTERVAL ?? 10_000);

// Worker identity
const workerId = crypto.randomUUID();

// Sources
const notionSource = new NotionSource();
const strapiSource = new StrapiSource();
const webSource = new WebSource();
const contentfulSource = new ContentfulSource();

// Handle messages from the app
self.onmessage = (e: MessageEvent) => {
  if (e.data.type === SyncMessageType.SHUTDOWN) {
    process.exit(0);
  }
};

// Job processing as an Effect
const processJob = (job: { id: number; sourceCollectionId: number }) =>
  Effect.gen(function* () {
    const config = yield* Effect.tryPromise({
      try: () =>
        Effect.runPromise(getJobConfig(workerDb, { sourceCollectionId: job.sourceCollectionId })),
      catch: (e) => e,
    });
    if (!config) {
      yield* Effect.logWarning("Source collection config not found").pipe(
        Effect.annotateLogs({
          module: "sync-worker",
          jobId: job.id,
          sourceCollectionId: job.sourceCollectionId,
        }),
      );
      yield* Effect.tryPromise({
        try: () =>
          Effect.runPromise(failJob(workerDb, job.id, "Source collection config not found")),
        catch: (e) => e,
      });
      return;
    }

    yield* Effect.logDebug("Fetching source collection").pipe(
      Effect.annotateLogs({
        module: "sync-worker",
        jobId: job.id,
        sourceCollectionId: job.sourceCollectionId,
        sourceType: config.sourceType,
      }),
    );

    const userId = config.userId;
    const fetchedItems: UserSyncItem[] = [];

    // Dispatch to appropriate source adapter
    yield* Effect.tryPromise({
      try: async () => {
        if (config.sourceType === SourceType.NOTION) {
          for await (const item of notionSource.fetch({
            collection: config.collectionId,
            ref: config.collectionRef!,
            credentials: config.credentials?.toString("utf-8") ?? "",
          })) {
            const sourceRef = getItemRefForSource({
              sourceType: config.sourceType,
              rawRef: item.ref,
              sourceUrl: config.sourceUrl,
              collectionRef: config.collectionRef,
            });
            fetchedItems.push({
              ...item,
              user: userId,
              sourceType: sourceRef.sourceType,
              ref: sourceRef.ref,
            });
          }
        } else if (config.sourceType === SourceType.STRAPI) {
          for await (const item of strapiSource.fetch({
            collection: config.collectionId,
            ref: config.collectionRef!,
            url: config.sourceUrl!,
            credentials: config.credentials!,
          })) {
            const sourceRef = getItemRefForSource({
              sourceType: config.sourceType,
              rawRef: item.ref,
              sourceUrl: config.sourceUrl,
              collectionRef: config.collectionRef,
            });
            fetchedItems.push({
              ...item,
              user: userId,
              sourceType: sourceRef.sourceType,
              ref: sourceRef.ref,
            });
          }
        } else if (config.sourceType === SourceType.CONTENTFUL) {
          for await (const item of contentfulSource.fetch({
            collection: config.collectionId,
            ref: config.collectionRef!,
            spaceId: config.sourceUrl!,
            credentials: config.credentials!,
          })) {
            const sourceRef = getItemRefForSource({
              sourceType: config.sourceType,
              rawRef: item.ref,
              sourceUrl: config.sourceUrl,
              collectionRef: config.collectionRef,
            });
            fetchedItems.push({
              ...item,
              user: userId,
              sourceType: sourceRef.sourceType,
              ref: sourceRef.ref,
            });
          }
        } else {
          for await (const item of webSource.fetch({
            collection: config.collectionId,
            ref: config.collectionRef!,
            url: config.sourceUrl!,
            credentials: config.credentials ?? undefined,
          })) {
            const sourceRef = getItemRefForSource({
              sourceType: config.sourceType,
              rawRef: item.ref,
              sourceUrl: config.sourceUrl,
              collectionRef: config.collectionRef,
            });
            fetchedItems.push({
              ...item,
              user: userId,
              sourceType: sourceRef.sourceType,
              ref: sourceRef.ref,
            });
          }
        }
      },
      catch: (e) => e,
    });

    yield* Effect.logInfo("Source collection fetch complete").pipe(
      Effect.annotateLogs({
        module: "sync-worker",
        jobId: job.id,
        sourceCollectionId: job.sourceCollectionId,
        itemCount: fetchedItems.length,
      }),
    );

    // Post items to main thread for SSE broadcast
    if (fetchedItems.length > 0) {
      self.postMessage({
        type: SyncMessageType.ITEMS_FETCHED,
        items: fetchedItems,
        userId,
        sourceCollectionId: job.sourceCollectionId,
      });
      yield* Effect.logDebug("Items posted to main thread").pipe(
        Effect.annotateLogs({
          module: "sync-worker",
          sourceCollectionId: job.sourceCollectionId,
          itemCount: fetchedItems.length,
        }),
      );

      // Update item IDs in source_collection directly
      yield* Effect.tryPromise({
        try: () =>
          updateItemIds(
            job.sourceCollectionId,
            fetchedItems.map((i) => i.id),
          ),
        catch: (e) => e,
      });
    }

    yield* Effect.tryPromise({
      try: () => Effect.runPromise(completeJob(workerDb, job.id)),
      catch: (e) => e,
    });
    yield* Effect.logDebug("Job completed").pipe(
      Effect.annotateLogs({ module: "sync-worker", jobId: job.id }),
    );
  }).pipe(
    Effect.catchAll((e) =>
      Effect.gen(function* () {
        yield* Effect.logError("Job failed").pipe(
          Effect.annotateLogs({ module: "sync-worker", err: e, jobId: job.id }),
        );
        yield* Effect.tryPromise({
          try: () => Effect.runPromise(failJob(workerDb, job.id, String(e))),
          catch: () => void 0,
        });
      }),
    ),
    Effect.withSpan("syncWorker.processJob", {
      attributes: { jobId: job.id, sourceCollectionId: job.sourceCollectionId },
    }),
  );

// Sync loop as an Effect
const syncLoop = Effect.gen(function* () {
  const jobs = yield* Effect.tryPromise({
    try: () => Effect.runPromise(claimJobs(workerDb, workerId, MAX_COLLECTION_PULL_SIZE)),
    catch: (e) => e,
  });

  if (jobs.length > 0) {
    yield* Effect.logDebug("Claimed sync jobs").pipe(
      Effect.annotateLogs({ module: "sync-worker", jobCount: jobs.length, workerId }),
    );
  }

  for (const job of jobs) {
    yield* processJob(job);
  }
}).pipe(
  Effect.withSpan("syncWorker.syncLoop"),
  Effect.catchAll((e) =>
    Effect.logError("Sync error").pipe(Effect.annotateLogs({ module: "sync-worker", err: e })),
  ),
  Effect.repeat(Schedule.fixed(Duration.millis(MIN_FETCH_INTERVAL))),
);

// Item ID management (direct DB access)

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

async function updateItemIds(sourceCollectionId: number, newIds: Buffer[]) {
  const [row] = await workerDb
    .select({ itemIds: sourceCollectionTable.itemIds })
    .from(sourceCollectionTable)
    .where(eq(sourceCollectionTable.id, sourceCollectionId));

  const existingIds = row?.itemIds ? deserializeIds(row.itemIds) : [];

  const ids = new SortedSet<Buffer>({
    seed: existingIds,
    isSorted: true,
    compare: (a: Buffer, b: Buffer) => a.compare(b),
  });

  for (const id of newIds) ids.add(id);

  await workerDb
    .update(sourceCollectionTable)
    .set({ itemIds: Buffer.concat(ids as unknown as Uint8Array[]) })
    .where(eq(sourceCollectionTable.id, sourceCollectionId));
}

// Start the sync loop
Effect.runFork(syncLoop.pipe(Effect.provide(LoggerLive)));

// Signal ready
log.info({ workerId }, "Sync worker ready");
self.postMessage({ type: SyncMessageType.WORKER_READY });
