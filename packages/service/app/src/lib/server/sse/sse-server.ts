import {
  EventType,
  type ChangedEvent,
  type ChecksumEvent,
  type ConnectedEvent,
  type DeletedEvent,
  type ErrorEvent,
  type ItemEvent,
  type ListIdsEvent,
  type UserSyncItem,
} from "@contfu/core";
import { eq } from "drizzle-orm";
import { consumerTable, db } from "../db/db";
import type { SyncWorkerManager } from "../sync-worker/worker-manager";

/**
 * SSE connection object that wraps a ReadableStreamDefaultController.
 */
type SSEConnection = {
  id: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
};

class ConnectionError extends Error {
  constructor(
    readonly code: "E_AUTH" | "E_CONFLICT" | "E_ACCESS",
    message?: string,
  ) {
    super(message);
  }
}

/** Maps consumer key (hex) to SSE connection. */
const consumerToConnection = new Map<string, SSEConnection>();
/** Maps connection ID to consumer key (hex). */
const connectionToConsumer = new Map<string, string>();
/** Maps consumer key (hex) to consumer info. */
const consumerInfo = new Map<string, { userId: string; consumerId: number }>();

export class SSEServer {
  private worker: SyncWorkerManager | null = null;

  constructor() {}

  setWorker(worker: SyncWorkerManager) {
    this.worker = worker;
  }

  /**
   * Adds a new SSE connection with authentication.
   * Returns the connection ID on success, or a ConnectionError on failure.
   */
  async addConnection(
    key: Buffer,
    controller: ReadableStreamDefaultController<Uint8Array>,
  ): Promise<string | ConnectionError> {
    const client = await authenticateConsumer(key);
    if (!client) return new ConnectionError("E_AUTH");

    const consumerKey = key.toString("hex");
    const existingConnection = consumerToConnection.get(consumerKey);
    if (existingConnection) return new ConnectionError("E_CONFLICT");

    const connectionId = crypto.randomUUID();
    const encoder = new TextEncoder();
    const connection: SSEConnection = { id: connectionId, controller, encoder };

    try {
      await this.worker?.activateConsumer(client.userId, client.id);
      consumerToConnection.set(consumerKey, connection);
      connectionToConsumer.set(connectionId, consumerKey);
      consumerInfo.set(consumerKey, { userId: client.userId, consumerId: client.id });

      // Send CONNECTED event
      this.sendEvent(connection, { type: EventType.CONNECTED });

      return connectionId;
    } catch (error) {
      // Clean up maps if activation or send fails
      consumerToConnection.delete(consumerKey);
      connectionToConsumer.delete(connectionId);
      consumerInfo.delete(consumerKey);
      console.error("Failed to connect consumer:", error);
      return new ConnectionError("E_ACCESS");
    }
  }

  /**
   * Removes an SSE connection and cleans up resources.
   */
  removeConnection(connectionId: string) {
    const consumerKey = connectionToConsumer.get(connectionId);
    if (!consumerKey) return;

    connectionToConsumer.delete(connectionId);
    consumerToConnection.delete(consumerKey);

    const info = consumerInfo.get(consumerKey);
    if (info) {
      consumerInfo.delete(consumerKey);
      this.worker?.deactivateConsumer(info.userId, info.consumerId);
    }
  }

  /**
   * Broadcasts items to connected SSE consumers.
   */
  async broadcast(items: UserSyncItem[], connections: ConnectionInfo[]) {
    const collectionEvents = new Map<string, Exclude<ItemEvent, ListIdsEvent>[]>();

    for (const item of items) {
      const collectionKey = `${item.user}:${item.collection}`;
      const events = collectionEvents.get(collectionKey) ?? [];
      if (events.length === 0) collectionEvents.set(collectionKey, events);
      events.push(changedEvent(item));
    }

    for (const conn of connections) {
      // Find connection by looking up consumer info
      let connection: SSEConnection | undefined;
      for (const [key, info] of consumerInfo.entries()) {
        if (info.userId === conn.userId && info.consumerId === conn.consumerId) {
          connection = consumerToConnection.get(key);
          break;
        }
      }
      if (!connection) continue;

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
        this.sendEvent(connection, event);
      }
    }
  }

  /**
   * Sends an SSE event to a specific connection.
   */
  private sendEvent(connection: SSEConnection, event: ItemEvent | ErrorEvent | ConnectedEvent) {
    try {
      const sseMessage = serializeEvent(event);
      const encoded = connection.encoder.encode(sseMessage);
      connection.controller.enqueue(encoded);
    } catch (error) {
      console.error("Failed to send SSE event:", error);
    }
  }
}

export type ConnectionInfo = {
  userId: string;
  consumerId: number;
  collectionId: number;
  lastItemChanged: number | null;
};

function changedEvent(item: UserSyncItem): ChangedEvent {
  return { type: EventType.CHANGED, item };
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

/**
 * Serializes an event to SSE format (text-based with JSON).
 * Format: event: <name>\ndata: <json>\n\n
 */
function serializeEvent(event: ItemEvent | ErrorEvent | ConnectedEvent): string {
  switch (event.type) {
    case EventType.CONNECTED: {
      return `event: connected\ndata: ${JSON.stringify({ type: EventType.CONNECTED })}\n\n`;
    }
    case EventType.CHANGED: {
      const { item } = event;
      const data = {
        type: EventType.CHANGED,
        item: {
          ref: item.ref.toString("base64"),
          id: item.id.toString("base64"),
          collection: item.collection,
          publishedAt: item.publishedAt,
          createdAt: item.createdAt,
          changedAt: item.changedAt,
          props: serializeProps(item.props),
          content: item.content,
        },
      };
      return `event: changed\ndata: ${JSON.stringify(data)}\n\n`;
    }
    case EventType.DELETED: {
      const data = {
        type: EventType.DELETED,
        item: event.item.toString("base64"),
      };
      return `event: deleted\ndata: ${JSON.stringify(data)}\n\n`;
    }
    case EventType.LIST_IDS: {
      const data = {
        type: EventType.LIST_IDS,
        collection: event.collection,
        ids: event.ids.map((id) => id.toString("base64")),
      };
      return `event: list_ids\ndata: ${JSON.stringify(data)}\n\n`;
    }
    case EventType.CHECKSUM: {
      const data = {
        type: EventType.CHECKSUM,
        collection: event.collection,
        checksum: event.checksum.toString("base64"),
      };
      return `event: checksum\ndata: ${JSON.stringify(data)}\n\n`;
    }
    case EventType.ERROR: {
      const data = {
        type: EventType.ERROR,
        code: event.code,
      };
      return `event: error\ndata: ${JSON.stringify(data)}\n\n`;
    }
  }
}

/**
 * Serializes props, converting Buffer arrays to base64.
 */
function serializeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (Array.isArray(value) && value.length > 0 && value[0] instanceof Buffer) {
      result[key] = (value as Buffer[]).map((buf) => buf.toString("base64"));
    } else {
      result[key] = value;
    }
  }
  return result;
}
