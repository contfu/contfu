import { authenticateSyncRequest, runSyncSession } from "$lib/server/sync-session";
import { createLogger } from "@contfu/svc-backend/infra/logger/index";
import { getStreamServer } from "$lib/server/startup";
import type { RequestHandler } from "./$types";

const log = createLogger("api-sync");

export const GET: RequestHandler = async ({ request, url }) => {
  const auth = await authenticateSyncRequest(request, url);
  if (auth instanceof Response) {
    return auth;
  }

  const server = getStreamServer();
  let cleanupConnection: (() => void) | null = null;
  let resolveClosed: (() => void) | null = null;
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });

  const stream = new ReadableStream({
    cancel() {
      cleanupConnection?.();
    },
    async start(controller) {
      let cleanedUp = false;
      let connectionId: string | null = null;
      let keepAlive: ReturnType<typeof setInterval> | null = null;

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
        resolveClosed?.();
        resolveClosed = null;
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

        const result = await server.finalizeConnection(auth.key, controller);
        if (typeof result !== "string") {
          cleanup();
          return;
        }

        connectionId = result;
        log.info(
          {
            userId: auth.userId,
            appConnectionId: auth.appConnectionId,
            connectionId,
          },
          "HTTP sync connection established",
        );

        if (!server.sendPingForConnection(connectionId)) {
          cleanup();
          return;
        }

        keepAlive = setInterval(() => {
          try {
            if (!connectionId || !server.sendPingForConnection(connectionId)) {
              cleanup();
            }
          } catch {
            cleanup();
          }
        }, 10_000);

        await runSyncSession({
          streamConnectionId: connectionId,
          userId: auth.userId,
          appConnectionId: auth.appConnectionId,
          requestedFromSeq: auth.requestedFromSeq,
          abortSignal: request.signal,
        });

        // Keep the HTTP stream request alive for post-replay pings and live events
        // until the client disconnects or the request is aborted.
        await closed;
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

export const OPTIONS: RequestHandler = () => {
  return new Response(null, { status: 204 });
};
