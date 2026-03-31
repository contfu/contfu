import { building } from "$app/environment";
import { auth } from "$lib/server/auth";
import { getRuntime } from "$lib/server/effect-runtime";
import { getStreamServer, initialize, shutdown } from "$lib/server/startup";
import { authenticateSyncRequest, runSyncSession } from "$lib/server/sync-session";
import { ClientEventType, type ClientWireEvent } from "@contfu/core";
import { UserRole } from "@contfu/svc-backend/domain/types";
import { closeDb, db } from "@contfu/svc-backend/infra/db/db";
import { userTable } from "@contfu/svc-backend/infra/db/schema";
import { withLogContext } from "@contfu/svc-backend/infra/logger/log-context";
import { createLogger } from "@contfu/svc-backend/infra/logger/index";
import type { Handle } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { eq } from "drizzle-orm";
import { unpack } from "msgpackr";

const log = createLogger("hooks");

const wsKeepAliveTimers = new Map<string, ReturnType<typeof setInterval>>();
const WS_KEEPALIVE_INTERVAL_MS = 5 * 60 * 1000;
type BunPlatform = {
  server: {
    upgrade(
      request: Request,
      options: {
        data: {
          key: Buffer;
          userId: number;
          clientConnectionId: number;
          requestedFromSeq: number | null;
        };
      },
    ): boolean | Promise<boolean>;
  };
  request: Request;
};

// Initialize at startup. Skip during SSR build phase.
if (!building) {
  // Initialize legacy startup services (StreamServer, SyncWorkerManager, NATS)
  initialize().catch((error) => {
    log.error({ err: error }, "Failed to initialize server startup services");
  });

  // Register shutdown handlers for graceful cleanup
  process.on("SIGTERM", () => {
    void shutdown();
    void closeDb();
    void getRuntime().dispose();
  });

  process.on("SIGINT", () => {
    void shutdown();
    void closeDb();
    void getRuntime().dispose();
  });
}

const BASIC_AUTH = process.env.BASIC_AUTH;

function checkBasicAuth(request: Request): Response | null {
  if (!BASIC_AUTH) return null;

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    const encoded = authorization.slice(6);
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    if (decoded === BASIC_AUTH) return null;
  }

  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Contfu"' },
  });
}

const BASIC_AUTH_EXCLUDED = ["/api/", "/polar/", "/webhooks/", "/health", "/email-logo.png"];

export const handle: Handle = ({ event, resolve }) =>
  withLogContext({ requestId: crypto.randomUUID() }, async () => {
    const { pathname } = event.url;
    const isExcluded = BASIC_AUTH_EXCLUDED.some((prefix) => pathname.startsWith(prefix));
    if (!isExcluded) {
      const authError = checkBasicAuth(event.request);
      if (authError) return authError;
    }

    const bunPlatform = event.platform as Partial<BunPlatform>;
    if (
      event.url.pathname === "/api/sync" &&
      event.request.headers.get("connection")?.toLowerCase().includes("upgrade") &&
      event.request.headers.get("upgrade")?.toLowerCase() === "websocket" &&
      bunPlatform.server &&
      bunPlatform.request
    ) {
      const authResult = await authenticateSyncRequest(event.request, event.url);
      if (authResult instanceof Response) {
        return authResult;
      }

      const upgraded = await bunPlatform.server.upgrade(bunPlatform.request, {
        data: {
          key: authResult.key,
          userId: authResult.userId,
          clientConnectionId: authResult.clientConnectionId,
          requestedFromSeq: authResult.requestedFromSeq,
        },
      });

      return upgraded
        ? new Response(null, { status: 101 })
        : new Response("WebSocket upgrade failed", { status: 400 });
    }

    const session = await auth.api.getSession({ headers: event.request.headers });
    event.locals.session = session?.session ?? null;
    event.locals.user = session?.user ?? null;

    // Re-fetch user from DB to get current approval/role/plan status
    // (session cookie cache may be stale after admin changes)
    if (event.locals.user) {
      const [freshUser] = await db
        .select({
          approved: userTable.approved,
          role: userTable.role,
          basePlan: userTable.basePlan,
        })
        .from(userTable)
        .where(eq(userTable.id, Number(event.locals.user.id)));
      if (freshUser) {
        event.locals.user.approved = freshUser.approved;
        event.locals.user.role = freshUser.role;
        event.locals.user.basePlan = freshUser.basePlan;
      }
    }

    // Centralized admin check for /api/admin/* routes
    if (pathname.startsWith("/api/admin/")) {
      if (!event.locals.user || event.locals.user.role !== UserRole.ADMIN) {
        return new Response(JSON.stringify({ message: "Admin access required" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return svelteKitHandler({ event, resolve, auth, building });
  });

export const websocket: Bun.WebSocketHandler<{
  key: Buffer;
  userId: number;
  clientConnectionId: number;
  requestedFromSeq: number | null;
  streamConnectionId?: string;
}> = {
  async open(ws) {
    const result = await initializeWebSocketConnection(ws);
    if (typeof result !== "string") {
      ws.close(1011, "Failed to establish sync session");
      return;
    }

    ws.data.streamConnectionId = result;

    try {
      await runSyncSession({
        streamConnectionId: result,
        userId: ws.data.userId,
        clientConnectionId: ws.data.clientConnectionId,
        requestedFromSeq: ws.data.requestedFromSeq,
      });
    } catch (error) {
      log.error({ err: error }, "WebSocket sync session failed");
      ws.close(1011, "Sync session failed");
      return;
    }

    // Keepalive: send periodic pings as a fallback for ungraceful disconnect detection.
    // Graceful disconnects are handled by the close() handler via the WebSocket close frame.
    const server = getStreamServer();
    const connectionId = ws.data.streamConnectionId;
    if (connectionId) {
      const keepAlive = setInterval(() => {
        if (!server.sendPingForConnection(connectionId)) {
          clearInterval(keepAlive);
          wsKeepAliveTimers.delete(connectionId);
          try {
            ws.close(1001, "Connection stalled");
          } catch {
            // Socket may already be closed
          }
        }
      }, WS_KEEPALIVE_INTERVAL_MS);
      wsKeepAliveTimers.set(connectionId, keepAlive);
    }
  },
  async message(ws, message) {
    const streamConnectionId = ws.data.streamConnectionId;
    if (!streamConnectionId) return;

    getStreamServer().markConnectionPong(streamConnectionId);

    const rawMessage = message as unknown;

    if (
      typeof rawMessage === "string" ||
      !(
        Buffer.isBuffer(rawMessage) ||
        rawMessage instanceof ArrayBuffer ||
        ArrayBuffer.isView(rawMessage)
      )
    ) {
      return;
    }

    const payload = Buffer.isBuffer(rawMessage)
      ? rawMessage
      : rawMessage instanceof ArrayBuffer
        ? Buffer.from(rawMessage)
        : Buffer.from(rawMessage.buffer, rawMessage.byteOffset, rawMessage.byteLength);

    try {
      const decoded = unpack(payload) as ClientWireEvent | unknown;
      if (
        Array.isArray(decoded) &&
        decoded[0] === ClientEventType.ACK &&
        typeof decoded[1] === "number" &&
        Number.isFinite(decoded[1]) &&
        decoded[1] >= 0
      ) {
        await getStreamServer().ackConnectionSequence(
          ws.data.userId,
          ws.data.clientConnectionId,
          decoded[1],
        );
      }
    } catch (error) {
      log.warn({ err: error }, "Ignoring invalid WebSocket sync message");
    }
  },
  pong(ws) {
    const streamConnectionId = ws.data.streamConnectionId;
    if (!streamConnectionId) return;
    getStreamServer().markConnectionPong(streamConnectionId);
  },
  close(ws) {
    const streamConnectionId = ws.data.streamConnectionId;
    if (!streamConnectionId) return;
    const timer = wsKeepAliveTimers.get(streamConnectionId);
    if (timer !== undefined) {
      clearInterval(timer);
      wsKeepAliveTimers.delete(streamConnectionId);
    }
    getStreamServer().removeConnection(streamConnectionId);
  },
};

async function initializeWebSocketConnection(
  ws: Bun.ServerWebSocket<{
    key: Buffer;
    userId: number;
    clientConnectionId: number;
    requestedFromSeq: number | null;
    streamConnectionId?: string;
  }>,
): Promise<string | null> {
  const server = getStreamServer();
  const result = await server.finalizeConnection(ws.data.key, ws);
  if (typeof result !== "string") {
    log.warn(
      {
        userId: ws.data.userId,
        clientConnectionId: ws.data.clientConnectionId,
      },
      "WebSocket pre-auth expired before finalizeConnection",
    );
    return null;
  }

  log.info(
    {
      userId: ws.data.userId,
      clientConnectionId: ws.data.clientConnectionId,
      connectionId: result,
    },
    "WebSocket sync connection established",
  );
  return result;
}
