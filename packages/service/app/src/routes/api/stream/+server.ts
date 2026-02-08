import { getStreamServer } from "$lib/server/startup";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request, url }) => {
  // Get the singleton stream server instance
  const server = getStreamServer();

  // Extract consumer key from query param or Authorization header
  let keyString = url.searchParams.get("key");
  if (!keyString) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      keyString = authHeader.slice(7);
    }
  }

  if (!keyString) {
    return new Response("Missing authentication key", { status: 401 });
  }

  // Decode the key from base64url (consistent with WebSocket)
  let key: Buffer;
  try {
    key = Buffer.from(keyString, "base64url");
    if (key.length !== 32) {
      // Try standard base64 as fallback
      key = Buffer.from(keyString, "base64");
      if (key.length !== 32) {
        return new Response("Invalid key format", { status: 401 });
      }
    }
  } catch {
    return new Response("Invalid key encoding", { status: 401 });
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

      // Finalize the connection
      const result = await server.finalizeConnection(key, controller);

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
