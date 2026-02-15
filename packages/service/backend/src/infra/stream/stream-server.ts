import {
  EventType,
  WIRE_PING,
  type Item,
  type UserSyncItem,
  type WireEvent,
  type WireItem,
  type WireItemEvent,
} from "@contfu/core";
import { and, eq } from "drizzle-orm";
import { pack as msgpack } from "msgpackr";
import { enqueueSyncJobs } from "../../features/sync-jobs/enqueueSyncJobs";
import { connectionTable, consumerTable, db, influxTable } from "../db/db";
import { publishEvent } from "../nats/event-stream";
import type { ConnectionInfo } from "../types";

/**
 * Binary stream connection object that wraps a ReadableStreamDefaultController.
 */
type StreamConnection = {
  id: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
  /** Whether this connection wants indexed events (connected with ?from). */
  indexed: boolean;
};

class ConnectionError extends Error {
  constructor(
    readonly code: "E_AUTH" | "E_CONFLICT" | "E_ACCESS",
    message?: string,
  ) {
    super(message);
  }
}

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
  constructor() {}

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
   * Sets up the connection and enqueues sync jobs.
   */
  async finalizeConnection(
    key: Buffer,
    controller: ReadableStreamDefaultController<Uint8Array>,
    opts?: { indexed?: boolean },
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
    const connection: StreamConnection = {
      id: connectionId,
      controller,
      indexed: opts?.indexed ?? false,
    };

    try {
      consumerToConnection.set(consumerKey, connection);
      connectionToConsumer.set(connectionId, consumerKey);
      consumerInfo.set(consumerKey, { userId: client.userId, consumerId: client.id });

      // Enqueue sync jobs for collections this consumer is connected to
      const collectionIds = await getConsumerCollectionIds(client.userId, client.id);
      if (collectionIds.length > 0) {
        const sourceCollectionIds = await getSourceCollectionIdsForCollections(
          client.userId,
          collectionIds,
        );
        if (sourceCollectionIds.length > 0) {
          await enqueueSyncJobs(db, sourceCollectionIds);
        }
      }

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
   * Get the consumer info (userId, consumerId) for a given connection ID.
   */
  getConnectionConsumerInfo(connectionId: string): { userId: number; consumerId: number } | null {
    const consumerKey = connectionToConsumer.get(connectionId);
    if (!consumerKey) return null;
    return consumerInfo.get(consumerKey) ?? null;
  }

  /**
   * Removes a stream connection and cleans up resources.
   */
  removeConnection(connectionId: string) {
    const consumerKey = connectionToConsumer.get(connectionId);
    if (!consumerKey) return;

    connectionToConsumer.delete(connectionId);
    consumerToConnection.delete(consumerKey);
    consumerInfo.delete(consumerKey);
  }

  /**
   * Send a ping to keep the connection alive.
   */
  sendPing(controller: ReadableStreamDefaultController<Uint8Array>) {
    const wireEvent: WireEvent = [WIRE_PING];
    this.sendBinary(controller, wireEvent);
  }

  /**
   * Broadcasts items to connected stream consumers.
   * Also publishes each item event to JetStream for replay.
   */
  async broadcast(items: UserSyncItem[], connections: ConnectionInfo[]) {
    // Publish to JetStream and collect sequences per item (keyed by Item reference)
    const itemSequences = new Map<Item, number>();
    await Promise.all(
      items.map((item) => {
        const wireEvent: WireItemEvent = [EventType.CHANGED, toWireItem(item)];
        return publishEvent(item.user, item.collection, wireEvent).then(
          (seq) => itemSequences.set(item, seq),
          (err) => console.error("JetStream publish error:", err),
        );
      }),
    );

    const collectionItems = new Map<string, Item[]>();

    for (const item of items) {
      const collectionKey = `${item.user}:${item.collection}`;
      const list = collectionItems.get(collectionKey) ?? [];
      if (list.length === 0) collectionItems.set(collectionKey, list);
      list.push(item);
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
      const changedItems = collectionItems.get(collectionKey);
      if (!changedItems) continue;

      for (const item of changedItems) {
        if (
          conn.lastItemChanged != null &&
          item.changedAt < Math.floor(conn.lastItemChanged.getTime() / 1000)
        ) {
          continue;
        }
        const wireItem = toWireItem(item);
        if (connection.indexed) {
          const seq = itemSequences.get(item);
          if (seq) {
            this.sendBinary(connection.controller, [EventType.CHANGED, wireItem, seq]);
            continue;
          }
        }
        this.sendBinary(connection.controller, [EventType.CHANGED, wireItem]);
      }
    }
  }

  /**
   * Broadcasts DELETED events to connected stream consumers.
   * Also publishes the delete event to JetStream.
   */
  async broadcastDeleted(itemId: Buffer, connections: ConnectionInfo[]) {
    // Publish DELETED to JetStream for each affected collection
    const deletedWire: WireItemEvent = [EventType.DELETED, new Uint8Array(itemId)];
    const seqByCollection = new Map<number, number>();
    for (const conn of connections) {
      if (!seqByCollection.has(conn.collectionId)) {
        publishEvent(conn.userId, conn.collectionId, deletedWire).then(
          (seq) => seqByCollection.set(conn.collectionId, seq),
          (err) => console.error("JetStream publish error:", err),
        );
      }
    }

    for (const conn of connections) {
      let connection: StreamConnection | undefined;
      for (const [key, info] of consumerInfo.entries()) {
        if (info.userId === conn.userId && info.consumerId === conn.consumerId) {
          connection = consumerToConnection.get(key);
          break;
        }
      }
      if (!connection) continue;
      if (connection.indexed) {
        const seq = seqByCollection.get(conn.collectionId);
        if (seq) {
          this.sendBinary(connection.controller, [EventType.DELETED, new Uint8Array(itemId), seq]);
          continue;
        }
      }
      this.sendBinary(connection.controller, [EventType.DELETED, new Uint8Array(itemId)]);
    }
  }

  /**
   * Send a single wire item event (used by /api/sync endpoint).
   */
  sendItem(controller: ReadableStreamDefaultController<Uint8Array>, wireEvent: WireItemEvent) {
    this.sendBinary(controller, wireEvent);
  }

  /**
   * Send a wire item event with an appended sequence number (used by /api/stream replay).
   */
  sendIndexedItem(
    controller: ReadableStreamDefaultController<Uint8Array>,
    seq: number,
    wireEvent: WireItemEvent,
  ) {
    const [type, payload] = wireEvent;
    this.sendBinary(controller, [type, payload, seq] as WireItemEvent);
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
 * Convert an Item to wire item format.
 */
export function toWireItem(item: Item): WireItem {
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
  return wireItem;
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
    .limit(1);
  return consumers[0] ?? null;
}

export async function getConsumerCollectionIds(
  userId: number,
  consumerId: number,
): Promise<number[]> {
  const rows = await db
    .select({ collectionId: connectionTable.collectionId })
    .from(connectionTable)
    .where(and(eq(connectionTable.userId, userId), eq(connectionTable.consumerId, consumerId)));
  return rows.map((r) => r.collectionId);
}

async function getSourceCollectionIdsForCollections(
  userId: number,
  collectionIds: number[],
): Promise<number[]> {
  const rows: { sourceCollectionId: number }[] = [];
  for (const collectionId of collectionIds) {
    const influxes = await db
      .selectDistinct({ sourceCollectionId: influxTable.sourceCollectionId })
      .from(influxTable)
      .where(and(eq(influxTable.userId, userId), eq(influxTable.collectionId, collectionId)));
    rows.push(...influxes);
  }
  return [...new Set(rows.map((r) => r.sourceCollectionId))];
}
