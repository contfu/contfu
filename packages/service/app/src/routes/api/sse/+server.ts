import { getSSEServer } from "$lib/server/startup";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request, url }) => {
  // Get the singleton SSE server instance (wired to SyncWorkerManager in startup)
  const server = getSSEServer();

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

  // Decode the key from base64 or hex
  let key: Buffer;
  try {
    // Try base64 first (common for URLs)
    key = Buffer.from(keyString, "base64");
    // Consumer keys must be 32 bytes
    if (key.length !== 32) {
      // Try hex if base64 didn't produce 32 bytes
      key = Buffer.from(keyString, "hex");
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

  // Pre-authenticate before creating the stream (returns HTTP error codes, not SSE events)
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

  // Create SSE stream - auth already passed, now we just need to set up the connection
  const stream = new ReadableStream({
    async start(controller) {
      let connectionId: string | null = null;
      let keepAlive: ReturnType<typeof setInterval> | null = null;

      // Cleanup function to be called on abort or cancel
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

      // Register abort listener early
      const onAbort = () => {
        cleanup();
      };
      request.signal.addEventListener("abort", onAbort, { once: true });

      // Check if aborted during setup
      if (request.signal.aborted) {
        cleanup();
        return;
      }

      // Finalize the connection (auth already passed in preAuthenticate)
      const result = await server.finalizeConnection(key, controller);

      // Check if aborted during async finalizeConnection
      if (request.signal.aborted) {
        cleanup();
        return;
      }

      // Handle any errors during finalization (shouldn't happen after preAuth, but be safe)
      if (typeof result !== "string") {
        // Close silently - the error was already handled or is a race condition
        controller.close();
        request.signal.removeEventListener("abort", onAbort);
        return;
      }

      connectionId = result;

      // Keep-alive ping mechanism - send ping every 25 seconds
      keepAlive = setInterval(() => {
        try {
          const pingEvent = `event: ping\ndata: {}\n\n`;
          controller.enqueue(new TextEncoder().encode(pingEvent));
        } catch {
          // Controller may be closed, cleanup
          cleanup();
        }
      }, 25_000);
    },

    // Handle stream cancellation
    cancel() {
      // Stream cancelled by consumer - no additional cleanup needed
      // as abort handler will be called automatically
    },
  });

  // Return SSE response with proper headers
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { status: 204 });
};
