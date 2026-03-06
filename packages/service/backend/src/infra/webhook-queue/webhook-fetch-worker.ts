import { SourceType } from "@contfu/core";
import { createLogger } from "../logger/index";
import { matchesFilters } from "@contfu/svc-core";

const log = createLogger("webhook-fetch");
import { uuidToBuffer } from "@contfu/svc-sources";
import { fetchNotionPage } from "@contfu/svc-sources/notion";
import { and, desc, eq, inArray } from "drizzle-orm";
import { listInfluxesBySourceCollections } from "../../features/influxes/listInfluxesBySourceCollections";
import { runEffectWithServices } from "../../effect/run";
import { decryptCredentials } from "../crypto/credentials";
import { db } from "../db/db";
import {
  collectionTable,
  consumerCollectionTable,
  consumerTable,
  integrationTable,
  sourceCollectionTable,
  sourceTable,
  webhookLogTable,
} from "../db/schema";
import { notionRefUrlFromRawUuid } from "@contfu/svc-sources";
import type { StreamServer } from "../stream/stream-server";
import type { UserSyncItem } from "../sync-worker/messages";
import { isItemQuotaExceeded, getQuotaPeriodEnd } from "../nats/quota-kv";
import { clearPending, isPending } from "./pending-kv";
import { acquireRateSlot } from "./rate-limiter";
import { getRateLimitForSourceType, type WebhookFetchJob } from "./types";
import { consumeWebhookFetches } from "./webhook-fetch-queue";

const THREE_DAYS_S = 3 * 24 * 60 * 60;

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
    log.error({ err: error }, "Failed to write webhook log");
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processJob(job: WebhookFetchJob, streamServer: StreamServer): Promise<number> {
  const [source] = await db
    .select({
      credentials: sourceTable.credentials,
      includeRef: sourceTable.includeRef,
      integrationId: sourceTable.integrationId,
    })
    .from(sourceTable)
    .where(and(eq(sourceTable.userId, job.userId), eq(sourceTable.id, job.sourceId)))
    .limit(1);

  // Resolve credentials: inline on source, or fall through to integration
  let encryptedCreds = source?.credentials ?? null;
  if (!encryptedCreds && source?.integrationId) {
    const [integration] = await db
      .select({ credentials: integrationTable.credentials })
      .from(integrationTable)
      .where(eq(integrationTable.id, source.integrationId))
      .limit(1);
    encryptedCreds = integration?.credentials ?? null;
  }

  if (!encryptedCreds) {
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

  const credentials = await decryptCredentials(job.userId, encryptedCreds);
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

  const influxes = await runEffectWithServices(
    listInfluxesBySourceCollections(
      job.userId,
      sourceCollections.map((collection) => collection.id),
    ),
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
      consumerId: consumerCollectionTable.consumerId,
      collectionId: consumerCollectionTable.collectionId,
      connectionIncludeRef: consumerCollectionTable.includeRef,
      consumerIncludeRef: consumerTable.includeRef,
      collectionIncludeRef: collectionTable.includeRef,
      lastItemChanged: consumerCollectionTable.lastItemChanged,
    })
    .from(consumerCollectionTable)
    .innerJoin(
      collectionTable,
      and(
        eq(consumerCollectionTable.userId, collectionTable.userId),
        eq(consumerCollectionTable.collectionId, collectionTable.id),
      ),
    )
    .innerJoin(
      consumerTable,
      and(
        eq(consumerCollectionTable.userId, consumerTable.userId),
        eq(consumerCollectionTable.consumerId, consumerTable.id),
      ),
    )
    .where(
      and(
        eq(consumerCollectionTable.userId, job.userId),
        inArray(consumerCollectionTable.collectionId, targetCollectionIds),
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

async function getSourceMeta(
  userId: number,
  sourceId: number,
): Promise<{ type: SourceType; integrationId: number | null } | null> {
  const [source] = await db
    .select({ type: sourceTable.type, integrationId: sourceTable.integrationId })
    .from(sourceTable)
    .where(and(eq(sourceTable.userId, userId), eq(sourceTable.id, sourceId)))
    .limit(1);

  return source ?? null;
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
      log.warn({ err: error }, "Invalid job payload");
      message.ack();
      continue;
    }

    const pending = await isPending(job.userId, job.sourceId, job.pageId);
    if (!pending) {
      message.ack();
      continue;
    }

    try {
      const sourceMeta = await getSourceMeta(job.userId, job.sourceId);
      const rateLimitConfig =
        sourceMeta !== null ? getRateLimitForSourceType(sourceMeta.type) : null;

      let shouldSkip = false;
      while (rateLimitConfig) {
        const delay = await acquireRateSlot(
          job.userId,
          job.sourceId,
          rateLimitConfig,
          null,
          sourceMeta?.integrationId,
        );
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

      // Long-term overage: if quota exceeded and period won't renew within 3 days, drop the event
      if (await isItemQuotaExceeded(job.userId)) {
        const periodEnd = await getQuotaPeriodEnd(job.userId);
        const now = Math.floor(Date.now() / 1000);
        if (periodEnd === 0 || periodEnd - now > THREE_DAYS_S) {
          log.info(
            { userId: job.userId, sourceId: job.sourceId, pageId: job.pageId },
            "Dropping webhook event due to long-term quota overage",
          );
          await clearPending(job.userId, job.sourceId, job.pageId);
          message.ack();
          continue;
        }
      }

      await processJob(job, streamServer);
      await clearPending(job.userId, job.sourceId, job.pageId);
      message.ack();
    } catch (error) {
      const deliveryCount = message.info?.deliveryCount ?? (message.redelivered ? 2 : 1);
      const maxDeliverReached = deliveryCount >= 4;

      log.error(
        { err: error, userId: job.userId, sourceId: job.sourceId, pageId: job.pageId },
        "Failed processing webhook fetch job",
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
    log.error({ err: error }, "Worker exited with error");
  });
}

export function stopWebhookFetchWorker(): void {
  if (!workerTask) return;

  stopSignal?.abort();
  stopSignal = null;
  workerTask = null;
}
