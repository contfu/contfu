import {
  EventType,
  type ConnectedEvent,
  type ErrorEvent,
  type ItemEvent,
  type ListIdsEvent,
  type UserSyncItem,
} from "@contfu/core";
import { eq } from "drizzle-orm";
import { pack as msgpack } from "msgpackr";
import { consumerTable, db } from "../db/db";
import type { ConnectionInfo } from "../sse/sse-server";
import type { SyncWorkerManager } from "../sync-worker/worker-manager";

/**
 * WebSocket connection with associated metadata.
 */
type WSConnection = {
  id: string;
  ws: ServerWebSocket<WSData>;
};

/**
 * Data attached to each WebSocket connection.
 * Set during upgrade based on auth header.
 */
export type WSData = {
  connectionId: string;
  consumerKey: string;
  userId: number;
  consumerId: number;
};

/**
 * Wire format for WebSocket events.
 * Uses tuples for minimal MessagePack encoding size.
 *
 * Format: [type, ...payload]
 * - CONNECTED: [0]
 * - CHANGED: [1, [ref, id, collection, publishedAt, createdAt, changedAt, props, content?]]
 * - DELETED: [2, deletedItemId]
 * - LIST_IDS: [3, collection, ids[]]
 * - CHECKSUM: [4, collection, checksum]
 * - ERROR: [5, errorCode]
 */
type WireEvent =
  | [EventType.CONNECTED]
  | [EventType.CHANGED, WireItem]
  | [EventType.DELETED, Uint8Array]
  | [EventType.LIST_IDS, number, Uint8Array[]]
  | [EventType.CHECKSUM, number, Uint8Array]
  | [EventType.ERROR, string];

/**
 * Wire item format as tuple:
 * [ref, id, collection, publishedAt, createdAt, changedAt, props, content?]
 */
type WireItem = [
  Uint8Array, // ref
  Uint8Array, // id
  number, // collection
  number, // publishedAt
  number, // createdAt
  number, // changedAt
  Record<string, unknown>, // props
  unknown[]?, // content (optional)
];

/** Maps connection ID to WebSocket connection. */
const connections = new Map<string, WSConnection>();
/** Maps consumer key (hex) to connection ID. */
const consumerToConnection = new Map<string, string>();

export class WSServer {
  private worker: SyncWorkerManager | null = null;

  constructor() {}

  setWorker(worker: SyncWorkerManager) {
    this.worker = worker;
  }

  /**
   * Authenticate during WebSocket upgrade using HTTP headers.
   * Returns WSData if successful, or an error response.
   *
   * Supports (in order of priority):
   * - Sec-WebSocket-Protocol: contfu.<base64-key> (works in browsers)
   * - Authorization: Bearer <base64-key>
   * - X-Consumer-Key: <base64-key>
   */
  async authenticateUpgrade(
    request: Request,
  ): Promise<
    | { success: true; data: WSData; protocol?: string }
    | { success: false; status: number; message: string }
  > {
    // Extract key from headers
    let keyString: string | null = null;
    let protocol: string | undefined;

    // Check Sec-WebSocket-Protocol first (browser-compatible)
    const protocols = request.headers.get("Sec-WebSocket-Protocol");
    if (protocols) {
      const authProtocol = protocols
        .split(",")
        .map((p) => p.trim())
        .find((p) => p.startsWith("contfu."));
      if (authProtocol) {
        keyString = authProtocol.slice(7); // Remove "contfu." prefix
        protocol = authProtocol; // Echo back to client
      }
    }

    // Fallback to Authorization header
    if (!keyString) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        keyString = authHeader.slice(7);
      }
    }

    // Fallback to custom header
    if (!keyString) {
      keyString = request.headers.get("X-Consumer-Key");
    }

    if (!keyString) {
      return { success: false, status: 401, message: "Missing authentication" };
    }

    // Decode key from base64url (standard base64 has +,/,= which are invalid in Sec-WebSocket-Protocol)
    let key: Buffer;
    try {
      key = Buffer.from(keyString, "base64url");
      if (key.length !== 32) {
        return { success: false, status: 401, message: "Invalid key format" };
      }
    } catch {
      return { success: false, status: 401, message: "Invalid key encoding" };
    }

    const consumerKey = key.toString("hex");

    // Check for existing connection (conflict)
    if (consumerToConnection.has(consumerKey)) {
      return { success: false, status: 409, message: "Consumer already connected" };
    }

    // Authenticate consumer against database
    const client = await authenticateConsumer(key);
    if (!client) {
      return { success: false, status: 401, message: "Invalid or unknown consumer key" };
    }

    const connectionId = crypto.randomUUID();

    return {
      success: true,
      data: {
        connectionId,
        consumerKey,
        userId: client.userId,
        consumerId: client.id,
      },
      protocol, // Echo back to complete subprotocol handshake
    };
  }

  /**
   * Handle WebSocket open event.
   * Connection is already authenticated via upgrade headers.
   */
  async handleOpen(ws: ServerWebSocket<WSData>) {
    const { connectionId, consumerKey, userId, consumerId } = ws.data;

    try {
      // Activate consumer in worker
      await this.worker?.activateConsumer(userId, consumerId);

      // Register connection
      connections.set(connectionId, { id: connectionId, ws });
      consumerToConnection.set(consumerKey, connectionId);

      // Send CONNECTED event
      this.sendEvent(ws, { type: EventType.CONNECTED });
    } catch (error) {
      console.error("Failed to activate consumer:", error);
      this.sendError(ws, "E_ACCESS", "Failed to activate consumer");
      ws.close(1011, "Server error");
    }
  }

  /**
   * Handle incoming WebSocket message.
   * Currently no client->server messages are defined, but this
   * can be extended for future features (e.g., ping, subscribe).
   */
  async handleMessage(_ws: ServerWebSocket<WSData>, _message: string | Buffer) {
    // Future: handle client commands like ping, subscribe to specific collections, etc.
    // For now, we don't expect any client messages
  }

  /**
   * Handle WebSocket close event.
   */
  handleClose(ws: ServerWebSocket<WSData>) {
    const connectionId = ws.data.connectionId;
    this.removeConnection(connectionId);
  }

  /**
   * Remove a connection and clean up resources.
   */
  private removeConnection(connectionId: string) {
    const connection = connections.get(connectionId);
    if (!connection) return;

    connections.delete(connectionId);

    const consumerKey = connection.ws.data.consumerKey;
    if (consumerKey) {
      consumerToConnection.delete(consumerKey);

      const { userId, consumerId } = connection.ws.data;
      if (userId != null && consumerId != null) {
        this.worker?.deactivateConsumer(userId, consumerId);
      }
    }
  }

  /**
   * Broadcasts items to connected WebSocket consumers.
   */
  async broadcast(items: UserSyncItem[], connInfos: ConnectionInfo[]) {
    const collectionEvents = new Map<string, Exclude<ItemEvent, ListIdsEvent>[]>();

    for (const item of items) {
      const collectionKey = `${item.user}:${item.collection}`;
      const events = collectionEvents.get(collectionKey) ?? [];
      if (events.length === 0) collectionEvents.set(collectionKey, events);
      events.push({ type: EventType.CHANGED, item });
    }

    for (const conn of connInfos) {
      // Find connection by user/consumer ID
      let wsConnection: WSConnection | undefined;
      for (const [, connection] of connections) {
        const { userId, consumerId } = connection.ws.data;
        if (userId === conn.userId && consumerId === conn.consumerId) {
          wsConnection = connection;
          break;
        }
      }
      if (!wsConnection) continue;

      const collectionKey = `${conn.userId}:${conn.collectionId}`;
      const events = collectionEvents.get(collectionKey);
      if (!events) continue;

      for (const event of events) {
        if (
          event.type === EventType.CHANGED &&
          conn.lastItemChanged != null &&
          event.item.changedAt < conn.lastItemChanged
        ) {
          continue;
        }
        this.sendEvent(wsConnection.ws, event);
      }
    }
  }

  /**
   * Send an event to a WebSocket client using MessagePack.
   */
  private sendEvent(ws: ServerWebSocket<WSData>, event: ItemEvent | ErrorEvent | ConnectedEvent) {
    try {
      const wireEvent = toWireEvent(event);
      const encoded = msgpack(wireEvent);
      ws.sendBinary(encoded);
    } catch (error) {
      console.error("Failed to send WebSocket event:", error);
    }
  }

  /**
   * Send an error event to a WebSocket client.
   */
  private sendError(ws: ServerWebSocket<WSData>, code: string, _message?: string) {
    this.sendEvent(ws, { type: EventType.ERROR, code });
  }
}

/**
 * Convert an event to wire format (tuples) for MessagePack encoding.
 */
function toWireEvent(event: ItemEvent | ErrorEvent | ConnectedEvent): WireEvent {
  switch (event.type) {
    case EventType.CONNECTED:
      return [EventType.CONNECTED];

    case EventType.CHANGED: {
      const { item } = event;
      const wireItem: WireItem = [
        new Uint8Array(item.ref),
        new Uint8Array(item.id),
        item.collection,
        item.publishedAt ?? 0,
        item.createdAt,
        item.changedAt,
        serializeProps(item.props),
      ];
      if (item.content) {
        wireItem.push(item.content);
      }
      return [EventType.CHANGED, wireItem];
    }

    case EventType.DELETED:
      return [EventType.DELETED, new Uint8Array(event.item)];

    case EventType.LIST_IDS:
      return [EventType.LIST_IDS, event.collection, event.ids.map((id) => new Uint8Array(id))];

    case EventType.CHECKSUM:
      return [EventType.CHECKSUM, event.collection, new Uint8Array(event.checksum)];

    case EventType.ERROR:
      return [EventType.ERROR, event.code];
  }
}

/**
 * Serializes props, converting Buffer arrays to Uint8Array.
 */
function serializeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (Array.isArray(value) && value.length > 0 && value[0] instanceof Buffer) {
      result[key] = (value as Buffer[]).map((buf) => new Uint8Array(buf));
    } else {
      result[key] = value;
    }
  }
  return result;
}

async function authenticateConsumer(key: Buffer) {
  if (key.length !== 32) return null;
  const consumers = await db
    .select()
    .from(consumerTable)
    .where(eq(consumerTable.key, key))
    .limit(1)
    .all();
  return consumers[0] ?? null;
}

// Re-export for Bun WebSocket type compatibility
declare global {
  interface ServerWebSocket<T> {
    data: T;
    send(data: string | ArrayBufferLike | ArrayBuffer): void;
    sendBinary(data: ArrayBufferLike | ArrayBuffer | Uint8Array): void;
    close(code?: number, reason?: string): void;
  }
}
