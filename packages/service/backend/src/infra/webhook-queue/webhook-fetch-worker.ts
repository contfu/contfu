import { ConnectionType } from "@contfu/core";
import { createLogger } from "../logger/index";
import { matchesFilters } from "@contfu/svc-core";

const log = createLogger("webhook-fetch");
import { uuidToBuffer } from "@contfu/svc-sources";
import { fetchNotionPage } from "@contfu/svc-sources/notion";
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { runEffectWithServices } from "../../effect/run";
import { listFlowsBySourceCollections } from "../../features/flows/listFlowsBySourceCollections";
import { decryptCredentials } from "../crypto/credentials";
import { db } from "../db/db";
import { collectionTable, connectionTable, webhookLogTable } from "../db/schema";
import { notionRefUrlFromRawUuid } from "@contfu/svc-sources";
import type { StreamServer } from "../stream/stream-server";
import type { UserSyncItem } from "../sync-worker/messages";
import { checkQuota } from "../../features/quota/checkQuota";
import { getQuota } from "../../features/quota/getQuota";
import { clearPending, isPending } from "./pending-kv";
import { acquireRateSlot } from "./rate-limiter";
import { getRateLimitForConnectionType, type WebhookFetchJob } from "./types";
import { consumeWebhookFetches } from "./webhook-fetch-queue";
import type { ConnectionInfo } from "../types";

const THREE_DAYS_S = 3 * 24 * 60 * 60;

const MAX_LOGS_PER_CONNECTION = 50;

let workerTask: Promise<void> | null = null;
let stopSignal: AbortController | null = null;

async function logWebhookEvent(
  _userId: number,
  connectionId: number,
  event: string,
  model: string | null,
  status: "success" | "error",
  errorMessage?: string,
  itemsBroadcast?: number,
): Promise<void> {
  try {
    await db.insert(webhookLogTable).values({
      connectionId,
      event,
      model,
      status,
      errorMessage,
      itemsBroadcast: itemsBroadcast ?? 0,
    });

    const keepIds = db
      .select({ id: webhookLogTable.id })
      .from(webhookLogTable)
      .where(eq(webhookLogTable.connectionId, connectionId))
      .orderBy(desc(webhookLogTable.timestamp))
      .limit(MAX_LOGS_PER_CONNECTION);

    await db
      .delete(webhookLogTable)
      .where(
        and(
          eq(webhookLogTable.connectionId, connectionId),
          notInArray(webhookLogTable.id, keepIds),
        ),
      );
  } catch (error) {
    log.error({ err: error }, "Failed to write webhook log");
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processJob(job: WebhookFetchJob, streamServer: StreamServer): Promise<number> {
  // Get connection credentials directly
  const [connection] = await db
    .select({
      credentials: connectionTable.credentials,
      type: connectionTable.type,
      includeRef: connectionTable.includeRef,
    })
    .from(connectionTable)
    .where(and(eq(connectionTable.userId, job.userId), eq(connectionTable.id, job.connectionId)))
    .limit(1);

  if (!connection) {
    await logWebhookEvent(
      job.userId,
      job.connectionId,
      job.eventType,
      job.pageId,
      "error",
      "Connection not found",
    );
    return 0;
  }

  const encryptedCreds = connection.credentials;

  if (!encryptedCreds) {
    await logWebhookEvent(
      job.userId,
      job.connectionId,
      job.eventType,
      job.pageId,
      "error",
      "Connection credentials not found",
    );
    return 0;
  }

  const credentials = await decryptCredentials(job.userId, encryptedCreds);
  const token = credentials?.toString("utf8");
  if (!token) {
    await logWebhookEvent(
      job.userId,
      job.connectionId,
      job.eventType,
      job.pageId,
      "error",
      "Failed to decrypt connection credentials",
    );
    return 0;
  }

  const result = await fetchNotionPage(token, job.pageId, 0);
  const parentDatabaseId = result?.parentDatabaseId ?? job.parentDatabaseId;

  if (!result || !parentDatabaseId) {
    await logWebhookEvent(
      job.userId,
      job.connectionId,
      job.eventType,
      job.pageId,
      "success",
      "Page not found or no parent database",
      0,
    );
    return 0;
  }

  // Find source collections on this connection matching the parent database ref
  const ref = uuidToBuffer(parentDatabaseId);
  const sourceCollections = await db
    .select({ id: collectionTable.id })
    .from(collectionTable)
    .where(
      and(
        eq(collectionTable.userId, job.userId),
        eq(collectionTable.connectionId, job.connectionId),
        eq(collectionTable.ref, ref),
      ),
    );

  if (sourceCollections.length === 0) {
    await logWebhookEvent(
      job.userId,
      job.connectionId,
      job.eventType,
      job.pageId,
      "success",
      "No matching source collections",
      0,
    );
    return 0;
  }

  const sourceCollectionIds = sourceCollections.map((c) => c.id);

  // Find flows from those source collections
  const flows = await runEffectWithServices(listFlowsBySourceCollections(sourceCollectionIds));

  if (flows.length === 0) {
    await logWebhookEvent(
      job.userId,
      job.connectionId,
      job.eventType,
      job.pageId,
      "success",
      "No flows",
      0,
    );
    return 0;
  }

  const targetCollectionIds: number[] = [];
  const collectionRefPolicy = new Map<number, boolean>();
  for (const flow of flows) {
    if (flow.filters.length > 0 && !matchesFilters(result.item.props, flow.filters)) {
      continue;
    }
    targetCollectionIds.push(flow.targetId);
    const previous = collectionRefPolicy.get(flow.targetId) ?? true;
    collectionRefPolicy.set(
      flow.targetId,
      previous && Boolean(connection.includeRef) && Boolean(flow.includeRef),
    );
  }

  if (targetCollectionIds.length === 0) {
    await logWebhookEvent(
      job.userId,
      job.connectionId,
      job.eventType,
      job.pageId,
      "success",
      "No flows matched filters",
      0,
    );
    return 0;
  }

  // Find CLIENT connections that own the target collections
  const clientConnections = await db
    .select({
      connectionId: connectionTable.id,
      collectionId: collectionTable.id,
      connectionIncludeRef: connectionTable.includeRef,
      collectionIncludeRef: collectionTable.includeRef,
    })
    .from(collectionTable)
    .innerJoin(
      connectionTable,
      and(
        eq(collectionTable.connectionId, connectionTable.id),
        eq(connectionTable.type, ConnectionType.CLIENT),
      ),
    )
    .where(
      and(eq(collectionTable.userId, job.userId), inArray(collectionTable.id, targetCollectionIds)),
    );

  let itemsBroadcast = 0;
  for (const collectionId of targetCollectionIds) {
    const item: UserSyncItem = {
      ...result.item,
      ref: notionRefUrlFromRawUuid(result.item.ref),
      sourceType: ConnectionType.NOTION,
      user: job.userId,
      collection: collectionId,
    };

    const collectionOutflows: ConnectionInfo[] = clientConnections
      .filter((c) => c.collectionId === collectionId)
      .map((c) => ({
        userId: job.userId,
        connectionId: c.connectionId,
        collectionId: c.collectionId,
        includeRef:
          Boolean(c.connectionIncludeRef) &&
          Boolean(c.collectionIncludeRef) &&
          (collectionRefPolicy.get(c.collectionId) ?? true),
      }));

    if (collectionOutflows.length === 0) continue;

    await streamServer.broadcast([item], collectionOutflows);
    itemsBroadcast += collectionOutflows.length;
  }

  await logWebhookEvent(
    job.userId,
    job.connectionId,
    job.eventType,
    job.pageId,
    "success",
    undefined,
    itemsBroadcast,
  );

  return itemsBroadcast;
}

async function getConnectionMeta(
  userId: number,
  connectionId: number,
): Promise<{ type: ConnectionType } | null> {
  const [row] = await db
    .select({ type: connectionTable.type })
    .from(connectionTable)
    .where(and(eq(connectionTable.userId, userId), eq(connectionTable.id, connectionId)))
    .limit(1);

  return row ?? null;
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

    const pending = await isPending(job.userId, job.connectionId, job.pageId);
    if (!pending) {
      message.ack();
      continue;
    }

    try {
      const connectionMeta = await getConnectionMeta(job.userId, job.connectionId);
      const rateLimitConfig =
        connectionMeta !== null ? getRateLimitForConnectionType(connectionMeta.type) : null;

      let shouldSkip = false;
      while (rateLimitConfig) {
        const delay = await acquireRateSlot(
          job.userId,
          job.connectionId,
          rateLimitConfig,
          null,
          job.connectionId,
        );
        if (delay <= 0) {
          break;
        }

        message.working();
        await wait(delay);

        const stillPending = await isPending(job.userId, job.connectionId, job.pageId);
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
      if (!(await checkQuota(job.userId, "items")).allowed) {
        const { periodEnd } = await getQuota(job.userId);
        const now = Math.floor(Date.now() / 1000);
        if (periodEnd === 0 || periodEnd - now > THREE_DAYS_S) {
          log.info(
            { userId: job.userId, connectionId: job.connectionId, pageId: job.pageId },
            "Dropping webhook event due to long-term quota overage",
          );
          await clearPending(job.userId, job.connectionId, job.pageId);
          message.ack();
          continue;
        }
      }

      await processJob(job, streamServer);
      await clearPending(job.userId, job.connectionId, job.pageId);
      message.ack();
    } catch (error) {
      const deliveryCount = message.info?.deliveryCount ?? (message.redelivered ? 2 : 1);
      const maxDeliverReached = deliveryCount >= 4;

      log.error(
        { err: error, userId: job.userId, connectionId: job.connectionId, pageId: job.pageId },
        "Failed processing webhook fetch job",
      );

      if (maxDeliverReached) {
        await clearPending(job.userId, job.connectionId, job.pageId);
        await logWebhookEvent(
          job.userId,
          job.connectionId,
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

export async function startWebhookFetchWorker(opts: { streamServer: StreamServer }): Promise<void> {
  if (workerTask) {
    await stopWebhookFetchWorker();
  }

  stopSignal = new AbortController();
  workerTask = runWorker(opts.streamServer, stopSignal.signal).catch((error) => {
    log.error({ err: error }, "Worker exited with error");
  });
}

export async function stopWebhookFetchWorker(): Promise<void> {
  if (!workerTask) return;

  stopSignal?.abort();
  await workerTask;
  stopSignal = null;
  workerTask = null;
}
