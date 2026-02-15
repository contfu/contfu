import { extractConsumerKey } from "$lib/server/consumer-auth";
import { getStreamServer } from "$lib/server/startup";
import { hasNats } from "@contfu/svc-backend/infra/nats/connection";
import { isSequenceAvailable, replayEvents } from "@contfu/svc-backend/infra/nats/event-stream";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request, url }) => {
  // Get the singleton stream server instance
  const server = getStreamServer();

  // Extract and validate consumer key
  const auth = extractConsumerKey(url, request);
  if ("error" in auth) return auth.error;
  const { key } = auth;

  // Parse optional `from` query parameter for event replay
  const fromParam = url.searchParams.get("from");
  const fromSeq = fromParam != null ? Number.parseInt(fromParam, 10) : null;

  if (fromSeq != null) {
    if (!Number.isFinite(fromSeq) || fromSeq < 0) {
      return new Response("Invalid 'from' parameter", { status: 400 });
    }
    if (!hasNats()) {
      return new Response("Event replay unavailable", { status: 500 });
    }
    if (!(await isSequenceAvailable(fromSeq))) {
      return new Response("Event index expired, full resync required", { status: 410 });
    }
  }

  // Check if request is already aborted
  if (request.signal.aborted) {
    return new Response("Request aborted", { status: 499 });
  }

  // Pre-authenticate before creating the stream
  const authResult = await server.preAuthenticate(key);
  if (authResult.error) {
    switch (authResult.error) {
      case "E_AUTH":
        return new Response("Invalid or unknown consumer key", { status: 401 });
      case "E_CONFLICT":
        return new Response("Consumer already connected", { status: 409 });
      default:
        return new Response("Authentication failed", { status: 403 });
    }
  }

  // Create binary stream
  const stream = new ReadableStream({
    async start(controller) {
      let connectionId: string | null = null;
      let keepAlive: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        if (keepAlive) {
          clearInterval(keepAlive);
          keepAlive = null;
        }
        if (connectionId) {
          server.removeConnection(connectionId);
          connectionId = null;
        }
        try {
          controller.close();
        } catch {
          // Controller may already be closed
        }
      };

      const onAbort = () => cleanup();
      request.signal.addEventListener("abort", onAbort, { once: true });

      if (request.signal.aborted) {
        cleanup();
        return;
      }

      // Finalize the connection (indexed if replay requested)
      const result = await server.finalizeConnection(key, controller, {
        indexed: fromSeq != null,
      });

      if (request.signal.aborted) {
        cleanup();
        return;
      }

      if (typeof result !== "string") {
        controller.close();
        request.signal.removeEventListener("abort", onAbort);
        return;
      }

      connectionId = result;

      // Replay events from JetStream if `from` was specified
      if (fromSeq != null) {
        const info = server.getConnectionConsumerInfo(connectionId);
        if (info) {
          const { getConsumerCollectionIds } =
            await import("@contfu/svc-backend/infra/stream/stream-server");
          const collectionIds = await getConsumerCollectionIds(info.userId, info.consumerId);
          if (collectionIds.length > 0 && !request.signal.aborted) {
            try {
              for await (const { seq, event } of replayEvents({
                fromSeq,
                userId: info.userId,
                collectionIds,
              })) {
                if (request.signal.aborted) break;
                server.sendIndexedItem(controller, seq, event);
              }
            } catch (error) {
              console.error("Event replay error:", error);
            }
          }
        }
      }

      // Keep-alive ping every 25 seconds
      keepAlive = setInterval(() => {
        try {
          server.sendPing(controller);
        } catch {
          cleanup();
        }
      }, 25_000);
    },

    cancel() {
      // Stream cancelled by consumer
    },
  });

  // Return binary stream response
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
