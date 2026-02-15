import { extractConsumerKey } from "$lib/server/consumer-auth";
import { getStreamServer } from "$lib/server/startup";
import { EventType } from "@contfu/core";
import { eq } from "drizzle-orm";
import { consumerTable, db } from "@contfu/svc-backend/infra/db/db";
import { getLastSequence } from "@contfu/svc-backend/infra/nats/event-stream";
import { toWireItem } from "@contfu/svc-backend/infra/stream/stream-server";
import { fetchAndStreamItems } from "@contfu/svc-backend/features/sync/fetchAndStreamItems";
import { getConsumerSyncConfig } from "@contfu/svc-backend/features/sync/getConsumerSyncConfig";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request, url }) => {
  const server = getStreamServer();

  // Authenticate consumer
  const auth = extractConsumerKey(url, request);
  if ("error" in auth) return auth.error;
  const { key } = auth;

  if (request.signal.aborted) {
    return new Response("Request aborted", { status: 499 });
  }

  // Look up consumer by key
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

  // Snapshot the last sequence BEFORE streaming items
  const eventIndex = await getLastSequence();

  // Resolve consumer's sync config
  const config = await getConsumerSyncConfig(consumer.userId, consumer.id);

  // Stream items
  const stream = new ReadableStream({
    async start(controller) {
      const onAbort = () => {
        try {
          controller.close();
        } catch {
          // Controller may already be closed
        }
      };
      request.signal.addEventListener("abort", onAbort, { once: true });

      try {
        for await (const item of fetchAndStreamItems(config)) {
          if (request.signal.aborted) break;
          server.sendItem(controller, [EventType.CHANGED, toWireItem(item)]);
        }
      } catch (error) {
        console.error("Sync stream error:", error);
      } finally {
        if (!request.signal.aborted) {
          try {
            controller.close();
          } catch {
            // Controller may already be closed
          }
        }
        request.signal.removeEventListener("abort", onAbort);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Event-Index": String(eventIndex),
      "Cache-Control": "no-cache",
    },
  });
};
