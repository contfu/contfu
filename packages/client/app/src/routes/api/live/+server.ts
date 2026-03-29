import type { LiveEvent } from "$lib/live/types";
import { subscribeLiveUpdates } from "$lib/server/live-updates";
import { getSyncStatus } from "$lib/server/sync-status";
import type { RequestHandler } from "./$types";

const encoder = new TextEncoder();
const HEARTBEAT_MS = 25000;

export const GET: RequestHandler = ({ request }) => {
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let unsubscribe: (() => void) | null = null;
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      const send = (event: LiveEvent | { type: "ping"; ts: number }) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(serializeSseEvent(event)));
        } catch {
          close();
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeat !== null) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        try {
          controller.close();
        } catch {
          // noop: controller may already be closed/cancelled
        }
      };
      cleanup = close;

      unsubscribe = subscribeLiveUpdates((event) => {
        send(event);
      });

      send({ type: "ready", ts: Date.now() });
      const status = getSyncStatus();
      send({
        type: "sync-status",
        state: status.state,
        reason: status.reason,
        ts: Date.now(),
      });

      heartbeat = setInterval(() => {
        send({ type: "ping", ts: Date.now() });
      }, HEARTBEAT_MS);

      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
};

function serializeSseEvent(event: { type: string; ts: number; [key: string]: unknown }): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
