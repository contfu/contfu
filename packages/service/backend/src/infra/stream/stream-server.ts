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
import type { ConnectionInfo } from "../types";
import type { SyncWorkerManager } from "../sync-worker/worker-manager";

/**
 * Binary stream connection object that wraps a ReadableStreamDefaultController.
 */
type StreamConnection = {
  id: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
};

class ConnectionError extends Error {
  constructor(
    readonly code: "E_AUTH" | "E_CONFLICT" | "E_ACCESS",
    message?: string,
  ) {
    super(message);
  }
}

/**
 * Wire format for events.
 * Uses tuples for minimal MessagePack encoding size.
 *
 * Format: [type, ...payload] where type matches EventType enum:
 * - CONNECTED: [0] (EventType.CONNECTED)
 * - ERROR: [1, errorCode] (EventType.ERROR)
 * - CHANGED: [2, [ref, id, collection, publishedAt, createdAt, changedAt, props, content?]] (EventType.CHANGED)
 * - DELETED: [3, deletedItemId] (EventType.DELETED)
 * - LIST_IDS: [4, collection, ids[]] (EventType.LIST_IDS)
 * - CHECKSUM: [5, collection, checksum] (EventType.CHECKSUM)
 * - PING: [6] (keep-alive, no EventType)
 */
type WireEvent =
  | [EventType.CONNECTED]
  | [EventType.CHANGED, WireItem]
  | [EventType.DELETED, Uint8Array]
  | [EventType.LIST_IDS, number, Uint8Array[]]
  | [EventType.CHECKSUM, number, Uint8Array]
  | [EventType.ERROR, string]
  | [6]; // PING = 6

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

/** Maps consumer key (hex) to stream connection. */
const consumerToConnection = new Map<string, StreamConnection>();
/** Maps connection ID to consumer key (hex). */
const connectionToConsumer = new Map<string, string>();
/** Maps consumer key (hex) to consumer info. */
const consumerInfo = new Map<string, { userId: number; consumerId: number }>();
/** Temporary cache for pre-authenticated consumers (expires after 30s). */
const preAuthCache = new Map<
  string,
  { client: { id: number; userId: number }; timestamp: number }
>();

export class StreamServer {
  private worker: SyncWorkerManager | null = null;

  constructor() {}

  setWorker(worker: SyncWorkerManager) {
    this.worker = worker;
  }

  /**
   * Pre-authenticate a consumer key before creating the stream.
   * Returns proper HTTP error codes (401, 409) instead of stream errors.
   */
  async preAuthenticate(key: Buffer): Promise<{ error?: "E_AUTH" | "E_CONFLICT" | "E_ACCESS" }> {
    const client = await authenticateConsumer(key);
    if (!client) {
      return { error: "E_AUTH" };
    }

    const consumerKey = key.toString("hex");
    const existingConnection = consumerToConnection.get(consumerKey);
    if (existingConnection) {
      return { error: "E_CONFLICT" };
    }

    // Store pre-auth info for finalizeConnection
    preAuthCache.set(consumerKey, { client, timestamp: Date.now() });

    return {};
  }

  /**
   * Finalize the stream connection after pre-authentication passed.
   * Sets up the connection and sends the CONNECTED event.
   */
  async finalizeConnection(
    key: Buffer,
    controller: ReadableStreamDefaultController<Uint8Array>,
  ): Promise<string | ConnectionError> {
    const consumerKey = key.toString("hex");

    // Get pre-auth info (with 30s expiry)
    const preAuth = preAuthCache.get(consumerKey);
    if (!preAuth || Date.now() - preAuth.timestamp > 30000) {
      preAuthCache.delete(consumerKey);
      return new ConnectionError("E_AUTH");
    }
    preAuthCache.delete(consumerKey);

    const { client } = preAuth;

    // Double-check no connection exists (race condition protection)
    const existingConnection = consumerToConnection.get(consumerKey);
    if (existingConnection) {
      return new ConnectionError("E_CONFLICT");
    }

    const connectionId = crypto.randomUUID();
    const connection: StreamConnection = { id: connectionId, controller };

    try {
      await this.worker?.activateConsumer(client.userId, client.id);
      consumerToConnection.set(consumerKey, connection);
      connectionToConsumer.set(connectionId, consumerKey);
      consumerInfo.set(consumerKey, { userId: client.userId, consumerId: client.id });

      // Send CONNECTED event
      this.sendEvent(connection, { type: EventType.CONNECTED });

      return connectionId;
    } catch (error) {
      consumerToConnection.delete(consumerKey);
      connectionToConsumer.delete(connectionId);
      consumerInfo.delete(consumerKey);
      console.error("Failed to connect consumer:", error);
      return new ConnectionError("E_ACCESS");
    }
  }

  /**
   * Removes a stream connection and cleans up resources.
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
   * Send a ping to keep the connection alive.
   */
  sendPing(controller: ReadableStreamDefaultController<Uint8Array>) {
    const wireEvent: WireEvent = [6]; // PING
    this.sendBinary(controller, wireEvent);
  }

  /**
   * Broadcasts items to connected stream consumers.
   */
  async broadcast(items: UserSyncItem[], connections: ConnectionInfo[]) {
    const collectionEvents = new Map<string, Exclude<ItemEvent, ListIdsEvent>[]>();

    for (const item of items) {
      const collectionKey = `${item.user}:${item.collection}`;
      const events = collectionEvents.get(collectionKey) ?? [];
      if (events.length === 0) collectionEvents.set(collectionKey, events);
      events.push({ type: EventType.CHANGED, item });
    }

    for (const conn of connections) {
      // Find connection by looking up consumer info
      let connection: StreamConnection | undefined;
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
   * Sends an event to a specific connection using length-prefixed msgpack.
   */
  private sendEvent(connection: StreamConnection, event: ItemEvent | ErrorEvent | ConnectedEvent) {
    try {
      const wireEvent = toWireEvent(event);
      this.sendBinary(connection.controller, wireEvent);
    } catch (error) {
      console.error("Failed to send stream event:", error);
    }
  }

  /**
   * Sends a binary message with length prefix.
   * Format: [4-byte big-endian length][msgpack data]
   */
  private sendBinary(
    controller: ReadableStreamDefaultController<Uint8Array>,
    wireEvent: WireEvent,
  ) {
    const encoded = msgpack(wireEvent);

    // Create length prefix (4 bytes, big-endian)
    const lengthPrefix = new Uint8Array(4);
    const view = new DataView(lengthPrefix.buffer);
    view.setUint32(0, encoded.length, false); // big-endian

    // Send length prefix + data
    controller.enqueue(lengthPrefix);
    controller.enqueue(encoded);
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
