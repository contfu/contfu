import { extractConsumerKey } from "$lib/server/consumer-auth";
import { getStreamServer } from "$lib/server/startup";
import { EventType, WIRE_SNAPSHOT_END, WIRE_SNAPSHOT_START } from "@contfu/core";
import { createLogger } from "@contfu/svc-backend/infra/logger/index";
import { runEffectWithServices } from "@contfu/svc-backend/effect/run";
import { fetchAndStreamItems } from "@contfu/svc-backend/features/sync/fetchAndStreamItems";
import { getConsumerSyncConfig } from "@contfu/svc-backend/features/sync/getConsumerSyncConfig";
import { consumerTable, db } from "@contfu/svc-backend/infra/db/db";
import { hasNats } from "@contfu/svc-backend/infra/nats/connection";
import {
  getLastSequence,
  isSequenceAvailable,
  publishEvent,
  replayEvents,
} from "@contfu/svc-backend/infra/nats/event-stream";
import {
  getCollectionNamesByIds,
  getConsumerCollectionIds,
  getConsumerCollectionRefPolicy,
  toWireItem,
} from "@contfu/svc-backend/infra/stream/stream-server";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";

const log = createLogger("api-sync");

export const GET: RequestHandler = async ({ request, url }) => {
  const server = getStreamServer();

  const auth = extractConsumerKey(url, request);
  if ("error" in auth) return auth.error;
  const { key } = auth;

  const fromParam = url.searchParams.get("from");
  const requestedFromSeq = fromParam != null ? Number.parseInt(fromParam, 10) : null;
  if (requestedFromSeq != null && (!Number.isFinite(requestedFromSeq) || requestedFromSeq < 0)) {
    return new Response("Invalid 'from' parameter", { status: 400 });
  }

  if (request.signal.aborted) {
    return new Response("Request aborted", { status: 499 });
  }

  if (key.length !== 32) {
    return new Response("Invalid key format", { status: 401 });
  }

  const consumers = await db
    .select({ userId: consumerTable.userId, id: consumerTable.id })
    .from(consumerTable)
    .where(eq(consumerTable.key, key))
    .limit(1);
  const consumer = consumers[0];
  if (!consumer) {
    return new Response("Invalid or unknown consumer key", { status: 401 });
  }

  const authResult = await server.preAuthenticate(key);
  if (authResult.error) {
    switch (authResult.error) {
      case "E_AUTH":
        return new Response("Invalid or unknown consumer key", { status: 401 });
      default:
        return new Response("Authentication failed", { status: 403 });
    }
  }

  log.info(
    { userId: consumer.userId, consumerId: consumer.id, fromSeq: requestedFromSeq },
    "Consumer connected",
  );

  let fromSeq = requestedFromSeq;
  if (hasNats() && fromSeq != null) {
    const available = await isSequenceAvailable(fromSeq);
    if (!available) {
      fromSeq = null;
    }
  }
  // When NATS is unavailable, fromSeq stays as-is.
  // from != null means "I have data, skip snapshot."
  // Replay phase is skipped anyway because hasNats() is false.

  let cleanupConnection: (() => void) | null = null;

  const stream = new ReadableStream({
    cancel() {
      cleanupConnection?.();
    },
    async start(controller) {
      let connectionId: string | null = null;
      let keepAlive: ReturnType<typeof setInterval> | null = null;
      let cleanedUp = false;

      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        if (keepAlive) {
          clearInterval(keepAlive);
          keepAlive = null;
        }
        if (connectionId) {
          log.debug({ connectionId }, "Connection closed");
          server.removeConnection(connectionId);
          connectionId = null;
        }
        try {
          controller.close();
        } catch {
          // Controller may already be closed
        }
      };
      cleanupConnection = cleanup;

      const onAbort = () => cleanup();
      request.signal.addEventListener("abort", onAbort, { once: true });

      try {
        if (request.signal.aborted) return;

        const result = await server.finalizeConnection(key, controller);
        if (typeof result !== "string") {
          cleanup();
          return;
        }
        connectionId = result;
        log.info(
          { userId: consumer.userId, consumerId: consumer.id, connectionId },
          "Connection established",
        );

        const info = server.getConnectionConsumerInfo(connectionId);
        if (!info || request.signal.aborted) {
          cleanup();
          return;
        }

        // Start keepAlive pings before snapshot/replay so the client
        // doesn't detect a stall during long-running phases where all
        // events may be filtered out (e.g. snapshotSequences skip).
        keepAlive = setInterval(() => {
          try {
            if (!connectionId || !server.sendPingForConnection(connectionId)) {
              cleanup();
            }
          } catch {
            cleanup();
          }
        }, 10_000);

        const snapshotStartSeq = fromSeq == null ? await getLastSequence() : 0;
        const snapshotSequences = new Set<number>();
        const collectionNames = await getCollectionNamesByIds(
          await getConsumerCollectionIds(consumer.userId, consumer.id),
          consumer.userId,
        );

        if (fromSeq == null) {
          log.debug({ userId: consumer.userId, consumerId: consumer.id }, "Starting snapshot");
          server.sendBinaryEvent(controller, [WIRE_SNAPSHOT_START]);

          const config = await runEffectWithServices(
            getConsumerSyncConfig(consumer.userId, consumer.id),
          );

          let snapshotItemCount = 0;
          for await (const item of fetchAndStreamItems(config)) {
            if (request.signal.aborted) break;
            const wireEvent: [EventType.CHANGED, ReturnType<typeof toWireItem>] = [
              EventType.CHANGED,
              toWireItem(
                item,
                collectionNames.get(item.collection) ?? String(item.collection),
                item.includeRef,
              ),
            ];
            const seq = await publishEvent(item.user, item.collection, wireEvent);
            if (seq > 0) {
              snapshotSequences.add(seq);
            }
            snapshotItemCount++;
            server.sendIndexedItem(controller, seq, wireEvent, Boolean(item.includeRef));
          }

          server.sendBinaryEvent(controller, [WIRE_SNAPSHOT_END]);
          log.debug(
            { userId: consumer.userId, consumerId: consumer.id, itemCount: snapshotItemCount },
            "Snapshot complete",
          );
        }

        const replayStartSeq = fromSeq ?? snapshotStartSeq + 1;
        if (hasNats()) {
          const collectionIds = await getConsumerCollectionIds(info.userId, info.consumerId);
          const refPolicyByCollection = await getConsumerCollectionRefPolicy(
            info.userId,
            info.consumerId,
          );

          if (collectionIds.length > 0 && replayStartSeq > 0 && !request.signal.aborted) {
            log.debug(
              { userId: info.userId, consumerId: info.consumerId, fromSeq: replayStartSeq },
              "Starting replay",
            );
            for await (const { seq, collectionId, event } of replayEvents({
              fromSeq: replayStartSeq,
              userId: info.userId,
              collectionIds,
            })) {
              if (request.signal.aborted) break;
              if (snapshotSequences.has(seq)) continue;
              server.sendIndexedItem(
                controller,
                seq,
                event,
                refPolicyByCollection.get(collectionId) ?? true,
              );
            }
            log.debug({ userId: info.userId, consumerId: info.consumerId }, "Replay complete");
          }
        }
      } catch (error) {
        log.error({ err: error }, "Sync stream error");
        cleanup();
      } finally {
        request.signal.removeEventListener("abort", onAbort);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { status: 204 });
};
