import { SourceType } from "@contfu/core";
import { matchesFilters } from "@contfu/svc-core";
import { uuidToBuffer } from "@contfu/svc-sources";
import { fetchNotionPage } from "@contfu/svc-sources/notion";
import { and, desc, eq, inArray } from "drizzle-orm";
import { listInfluxesBySourceCollections } from "../../features/influxes/listInfluxesBySourceCollections";
import { decryptCredentials } from "../crypto/credentials";
import { db } from "../db/db";
import {
  collectionTable,
  connectionTable,
  consumerTable,
  sourceCollectionTable,
  sourceTable,
  webhookLogTable,
} from "../db/schema";
import { notionRefUrlFromRawUuid } from "../refs/encode-ref";
import type { StreamServer } from "../stream/stream-server";
import type { UserSyncItem } from "../sync-worker/messages";
import { clearPending, isPending } from "./pending-kv";
import { acquireRateSlot } from "./rate-limiter";
import { getRateLimitForSourceType, type WebhookFetchJob } from "./types";
import { consumeWebhookFetches } from "./webhook-fetch-queue";

const MAX_LOGS_PER_SOURCE = 50;

let workerTask: Promise<void> | null = null;
let stopSignal: AbortController | null = null;

async function logWebhookEvent(
  _userId: number,
  sourceId: number,
  event: string,
  model: string | null,
  status: "success" | "error",
  errorMessage?: string,
  itemsBroadcast?: number,
): Promise<void> {
  try {
    await db.insert(webhookLogTable).values({
      sourceId,
      event,
      model,
      status,
      errorMessage,
      itemsBroadcast: itemsBroadcast ?? 0,
    });

    const logs = await db
      .select({ id: webhookLogTable.id })
      .from(webhookLogTable)
      .where(eq(webhookLogTable.sourceId, sourceId))
      .orderBy(desc(webhookLogTable.timestamp))
      .limit(1000);

    if (logs.length > MAX_LOGS_PER_SOURCE) {
      const idsToDelete = logs.slice(MAX_LOGS_PER_SOURCE).map((l) => l.id);
      await db.delete(webhookLogTable).where(inArray(webhookLogTable.id, idsToDelete));
    }
  } catch (error) {
    console.error("[Webhook fetch worker] Failed to write webhook log:", error);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processJob(job: WebhookFetchJob, streamServer: StreamServer): Promise<number> {
  const [source] = await db
    .select({ credentials: sourceTable.credentials, includeRef: sourceTable.includeRef })
    .from(sourceTable)
    .where(and(eq(sourceTable.userId, job.userId), eq(sourceTable.id, job.sourceId)))
    .limit(1);

  if (!source?.credentials) {
    await logWebhookEvent(
      job.userId,
      job.sourceId,
      job.eventType,
      job.pageId,
      "error",
      "Source credentials not found",
    );
    return 0;
  }

  const credentials = await decryptCredentials(job.userId, source.credentials);
  const token = credentials?.toString("utf8");
  if (!token) {
    await logWebhookEvent(
      job.userId,
      job.sourceId,
      job.eventType,
      job.pageId,
      "error",
      "Failed to decrypt source credentials",
    );
    return 0;
  }

  const result = await fetchNotionPage(token, job.pageId, 0);
  const parentDatabaseId = result?.parentDatabaseId ?? job.parentDatabaseId;

  if (!result || !parentDatabaseId) {
    await logWebhookEvent(
      job.userId,
      job.sourceId,
      job.eventType,
      job.pageId,
      "success",
      "Page not found or no parent database",
      0,
    );
    return 0;
  }

  const ref = uuidToBuffer(parentDatabaseId);
  const sourceCollections = await db
    .select({ id: sourceCollectionTable.id })
    .from(sourceCollectionTable)
    .where(
      and(
        eq(sourceCollectionTable.userId, job.userId),
        eq(sourceCollectionTable.sourceId, job.sourceId),
        eq(sourceCollectionTable.ref, ref),
      ),
    );

  if (sourceCollections.length === 0) {
    await logWebhookEvent(
      job.userId,
      job.sourceId,
      job.eventType,
      job.pageId,
      "success",
      "No matching source collections",
      0,
    );
    return 0;
  }

  const influxes = await listInfluxesBySourceCollections(
    job.userId,
    sourceCollections.map((collection) => collection.id),
  );

  if (influxes.length === 0) {
    await logWebhookEvent(
      job.userId,
      job.sourceId,
      job.eventType,
      job.pageId,
      "success",
      "No influxes",
      0,
    );
    return 0;
  }

  const targetCollectionIds: number[] = [];
  const collectionRefPolicy = new Map<number, boolean>();
  for (const influx of influxes) {
    if (influx.filters.length > 0 && !matchesFilters(result.item.props, influx.filters)) {
      continue;
    }
    targetCollectionIds.push(influx.collectionId);
    const previous = collectionRefPolicy.get(influx.collectionId) ?? true;
    collectionRefPolicy.set(
      influx.collectionId,
      previous && Boolean(source.includeRef) && Boolean(influx.includeRef),
    );
  }

  if (targetCollectionIds.length === 0) {
    await logWebhookEvent(
      job.userId,
      job.sourceId,
      job.eventType,
      job.pageId,
      "success",
      "No influxes matched filters",
      0,
    );
    return 0;
  }

  const connections = await db
    .select({
      consumerId: connectionTable.consumerId,
      collectionId: connectionTable.collectionId,
      connectionIncludeRef: connectionTable.includeRef,
      consumerIncludeRef: consumerTable.includeRef,
      collectionIncludeRef: collectionTable.includeRef,
      lastItemChanged: connectionTable.lastItemChanged,
    })
    .from(connectionTable)
    .innerJoin(
      collectionTable,
      and(
        eq(connectionTable.userId, collectionTable.userId),
        eq(connectionTable.collectionId, collectionTable.id),
      ),
    )
    .innerJoin(
      consumerTable,
      and(
        eq(connectionTable.userId, consumerTable.userId),
        eq(connectionTable.consumerId, consumerTable.id),
      ),
    )
    .where(
      and(
        eq(connectionTable.userId, job.userId),
        inArray(connectionTable.collectionId, targetCollectionIds),
      ),
    );

  let itemsBroadcast = 0;
  for (const collectionId of targetCollectionIds) {
    const item: UserSyncItem = {
      ...result.item,
      ref: notionRefUrlFromRawUuid(result.item.ref),
      sourceType: SourceType.NOTION,
      user: job.userId,
      collection: collectionId,
    };

    const collectionConnections = connections
      .filter((connection) => connection.collectionId === collectionId)
      .map((connection) => ({
        userId: job.userId,
        consumerId: connection.consumerId,
        collectionId: connection.collectionId,
        includeRef:
          Boolean(connection.connectionIncludeRef) &&
          Boolean(connection.consumerIncludeRef) &&
          Boolean(connection.collectionIncludeRef) &&
          (collectionRefPolicy.get(connection.collectionId) ?? true),
        lastItemChanged: connection.lastItemChanged,
      }));

    if (collectionConnections.length === 0) continue;

    await streamServer.broadcast([item], collectionConnections);
    itemsBroadcast += collectionConnections.length;
  }

  await logWebhookEvent(
    job.userId,
    job.sourceId,
    job.eventType,
    job.pageId,
    "success",
    undefined,
    itemsBroadcast,
  );

  return itemsBroadcast;
}

async function getSourceType(userId: number, sourceId: number): Promise<SourceType | null> {
  const [source] = await db
    .select({ type: sourceTable.type })
    .from(sourceTable)
    .where(and(eq(sourceTable.userId, userId), eq(sourceTable.id, sourceId)))
    .limit(1);

  return source?.type ?? null;
}

async function runWorker(streamServer: StreamServer, signal: AbortSignal): Promise<void> {
  for await (const message of consumeWebhookFetches()) {
    if (signal.aborted) {
      message.ack();
      return;
    }

    let job: WebhookFetchJob;
    try {
      job = JSON.parse(Buffer.from(message.data).toString("utf8")) as WebhookFetchJob;
    } catch (error) {
      console.error("[Webhook fetch worker] Invalid job payload:", error);
      message.ack();
      continue;
    }

    const pending = await isPending(job.userId, job.sourceId, job.pageId);
    if (!pending) {
      message.ack();
      continue;
    }

    try {
      const sourceType = await getSourceType(job.userId, job.sourceId);
      const rateLimitConfig = sourceType !== null ? getRateLimitForSourceType(sourceType) : null;

      let shouldSkip = false;
      while (rateLimitConfig) {
        const delay = await acquireRateSlot(job.userId, job.sourceId, rateLimitConfig);
        if (delay <= 0) {
          break;
        }

        message.working();
        await wait(delay);

        const stillPending = await isPending(job.userId, job.sourceId, job.pageId);
        if (!stillPending) {
          message.ack();
          shouldSkip = true;
          break;
        }
      }

      if (shouldSkip) {
        continue;
      }

      await processJob(job, streamServer);
      await clearPending(job.userId, job.sourceId, job.pageId);
      message.ack();
    } catch (error) {
      const deliveryCount = message.info?.deliveryCount ?? (message.redelivered ? 2 : 1);
      const maxDeliverReached = deliveryCount >= 4;

      console.error(
        `[Webhook fetch worker] Failed processing ${job.userId}:${job.sourceId}:${job.pageId}`,
        error,
      );

      if (maxDeliverReached) {
        await clearPending(job.userId, job.sourceId, job.pageId);
        await logWebhookEvent(
          job.userId,
          job.sourceId,
          job.eventType,
          job.pageId,
          "error",
          error instanceof Error ? error.message : String(error),
        );
        message.ack();
      } else {
        message.nak(1000);
      }
    }
  }
}

export function startWebhookFetchWorker(opts: { streamServer: StreamServer }): void {
  if (workerTask) return;

  stopSignal = new AbortController();
  workerTask = runWorker(opts.streamServer, stopSignal.signal).catch((error) => {
    console.error("[Webhook fetch worker] Worker exited with error:", error);
  });
}

export async function stopWebhookFetchWorker(): Promise<void> {
  if (!workerTask) return;

  stopSignal?.abort();
  stopSignal = null;
  workerTask = null;
}
