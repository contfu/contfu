import { EventType, type WireEvent, type WireItem, type WireItemEvent } from "@contfu/core";
import { and, eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { pack as msgpack } from "msgpackr";
import { enqueueSyncJobs } from "../../features/sync-jobs/enqueueSyncJobs";
import { collectionTable, connectionTable, consumerTable, db, influxTable } from "../db/db";
import { createLogger } from "../logger/index";
import { publishEvent, purgeEventsUpTo, type StoredWireItemEvent } from "../nats/event-stream";
import { addItems, isItemQuotaExceeded } from "../nats/quota-kv";
import type { UserSyncItem } from "../sync-worker/messages";
import type { ConnectionInfo } from "../types";

const log = createLogger("stream");

/**
 * Binary stream connection object that wraps a ReadableStreamDefaultController.
 */
type StreamConnection = {
  id: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
  stalledSince: number | null;
};

class ConnectionError extends Error {
  constructor(
    readonly code: "E_AUTH" | "E_ACCESS",
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
const PRE_AUTH_TTL_MS = 30 * 1000;
const CONNECTION_STALL_TIMEOUT_MS = 60 * 1000;
/** Maps "userId:consumerId" to last acked sequence number. */
const consumerAckedSeq = new Map<string, number>();

export class StreamServer {
  /**
   * Returns true when the given consumer currently has a live stream connection.
   */
  isConsumerActive(userId: number, consumerId: number): boolean {
    this.pruneDeadConnections();
    return this.findConsumerConnection(userId, consumerId) !== null;
  }

  /**
   * Records the last-acked sequence for a consumer and attempts to purge
   * events that all active consumers have acknowledged.
   */
  async ackConsumerSequence(userId: number, consumerId: number, seq: number): Promise<void> {
    const key = `${userId}:${consumerId}`;
    consumerAckedSeq.set(key, seq);
    await this.tryPurgeEvents();
  }

  /**
   * Pre-authenticate a consumer key before creating the stream.
   * Returns proper HTTP error codes (401, 409) instead of stream errors.
   */
  async preAuthenticate(key: Buffer): Promise<{ error?: "E_AUTH" | "E_ACCESS" }> {
    this.pruneDeadConnections();
    const client = await authenticateConsumer(key);
    if (!client) {
      return { error: "E_AUTH" };
    }

    const consumerKey = key.toString("hex");
    const existingConnection = consumerToConnection.get(consumerKey);
    if (existingConnection) {
      // Allow reconnects by replacing the prior connection for this consumer key.
      this.removeConnection(existingConnection.id);
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
  ): Promise<string | ConnectionError> {
    this.pruneDeadConnections();
    const consumerKey = key.toString("hex");

    // Get pre-auth info (with expiry)
    const preAuth = preAuthCache.get(consumerKey);
    if (!preAuth || Date.now() - preAuth.timestamp > PRE_AUTH_TTL_MS) {
      preAuthCache.delete(consumerKey);
      return new ConnectionError("E_AUTH");
    }
    preAuthCache.delete(consumerKey);

    const { client } = preAuth;

    // Replace stale/duplicate connection for the same key.
    const existingConnection = consumerToConnection.get(consumerKey);
    if (existingConnection) {
      this.removeConnection(existingConnection.id);
    }

    const connectionId = crypto.randomUUID();
    const connection: StreamConnection = {
      id: connectionId,
      controller,
      stalledSince: null,
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
          await Effect.runPromise(enqueueSyncJobs(db, sourceCollectionIds));
        }
      }

      log.info(
        {
          userId: client.userId,
          consumerId: client.id,
          connectionId,
          activeConnections: consumerToConnection.size,
        },
        "Consumer stream finalized",
      );
      return connectionId;
    } catch (error) {
      consumerToConnection.delete(consumerKey);
      connectionToConsumer.delete(connectionId);
      consumerInfo.delete(consumerKey);
      log.error({ err: error }, "Failed to connect consumer");
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
    const info = consumerInfo.get(consumerKey);
    log.debug(
      {
        connectionId,
        userId: info?.userId,
        consumerId: info?.consumerId,
        activeConnections: consumerToConnection.size - 1,
      },
      "Connection removed",
    );

    connectionToConsumer.delete(connectionId);
    consumerToConnection.delete(consumerKey);
    consumerInfo.delete(consumerKey);
    if (info) {
      consumerAckedSeq.delete(`${info.userId}:${info.consumerId}`);
      void this.tryPurgeEvents();
    }
  }

  /**
   * Send a schema event for a collection.
   */
  sendSchema(
    controller: ReadableStreamDefaultController<Uint8Array>,
    collectionName: string,
    displayName: string,
    schema: Record<string, number>,
  ) {
    this.sendBinary(controller, [EventType.COLLECTION_SCHEMA, collectionName, displayName, schema]);
  }

  /**
   * Broadcast an arbitrary wire event to all active consumers connected to a
   * specific collection of a given user.
   */
  async broadcastToCollection(userId: number, collectionId: number, wireEvent: WireEvent) {
    this.pruneDeadConnections();
    for (const [consumerKey, info] of consumerInfo.entries()) {
      if (info.userId !== userId) continue;
      const consumerCollectionIds = await getConsumerCollectionIds(userId, info.consumerId);
      if (!consumerCollectionIds.includes(collectionId)) continue;
      const connection = consumerToConnection.get(consumerKey);
      if (!connection) continue;
      try {
        this.sendBinary(connection.controller, wireEvent);
      } catch {
        this.removeConnection(connection.id);
      }
    }
  }

  /**
   * Send a wire event to a specific consumer's active stream connection.
   */
  sendToConsumer(userId: number, consumerId: number, wireEvent: WireEvent) {
    this.pruneDeadConnections();
    const connection = this.findConsumerConnection(userId, consumerId);
    if (!connection) return;
    try {
      this.sendBinary(connection.controller, wireEvent);
    } catch {
      this.removeConnection(connection.id);
    }
  }

  /**
   * Send a ping to keep the connection alive.
   */
  sendPing(controller: ReadableStreamDefaultController<Uint8Array>) {
    const wireEvent: WireEvent = [EventType.PING];
    this.sendBinary(controller, wireEvent);
  }

  /**
   * Send a ping to an active connection and evict stale/dead streams.
   * Returns false if the connection is gone or was removed.
   */
  sendPingForConnection(connectionId: string): boolean {
    const consumerKey = connectionToConsumer.get(connectionId);
    if (!consumerKey) return false;
    const connection = consumerToConnection.get(consumerKey);
    if (!connection) return false;

    if (!this.updateConnectionHealth(connection)) {
      this.removeConnection(connectionId);
      return false;
    }

    try {
      this.sendBinary(connection.controller, [EventType.PING]);
    } catch {
      this.removeConnection(connectionId);
      return false;
    }

    if (!this.updateConnectionHealth(connection)) {
      this.removeConnection(connectionId);
      return false;
    }

    return true;
  }

  /**
   * Send an arbitrary wire event to a controller.
   */
  sendBinaryEvent(controller: ReadableStreamDefaultController<Uint8Array>, wireEvent: WireEvent) {
    this.sendBinary(controller, wireEvent);
  }

  /**
   * Broadcasts items to connected stream consumers.
   * Also publishes each item event to JetStream for replay.
   */
  async broadcast(items: UserSyncItem[], connections: ConnectionInfo[]) {
    this.pruneDeadConnections();
    const collectionNameById = await getCollectionNamesByIds(
      [...new Set(items.map((item) => item.collection))],
      items[0]?.user,
    );

    // Publish to JetStream and collect sequences per item (keyed by Item reference)
    const itemSequences = new Map<UserSyncItem, number>();
    await Promise.all(
      items.map((item) => {
        const collectionName = collectionNameById.get(item.collection) ?? String(item.collection);
        const wireEvent: StoredWireItemEvent = [
          EventType.ITEM_CHANGED,
          toWireItem(item, collectionName),
        ];
        return publishEvent(item.user, item.collection, wireEvent).then(
          (seq) => itemSequences.set(item, seq),
          (err) => log.error({ err }, "JetStream publish error"),
        );
      }),
    );

    // Count synced items for quota tracking
    const userId = items[0]?.user;
    if (userId != null) {
      await addItems(userId, items.length);
    }

    // Hold-back: skip delivery when item quota exceeded (events are still in JetStream for replay)
    if (userId != null && (await isItemQuotaExceeded(userId))) {
      log.info({ userId, itemCount: items.length }, "Item quota exceeded, skipping delivery");
      return;
    }

    const collectionItems = new Map<string, UserSyncItem[]>();

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
        const collectionName =
          collectionNameById.get(conn.collectionId) ?? String(conn.collectionId);
        const wireItem = toWireItem(item, collectionName, conn.includeRef);
        const seq = itemSequences.get(item);
        if (!seq) continue;
        this.sendBinary(connection.controller, [EventType.ITEM_CHANGED, wireItem, seq]);
      }
    }
  }

  /**
   * Broadcasts DELETED events to connected stream consumers.
   * Also publishes the delete event to JetStream.
   */
  async broadcastDeleted(itemId: Buffer, connections: ConnectionInfo[]) {
    this.pruneDeadConnections();
    // Publish DELETED to JetStream for each affected collection
    const deletedWire: StoredWireItemEvent = [EventType.ITEM_DELETED, new Uint8Array(itemId)];
    const seqByCollection = new Map<number, number>();
    for (const conn of connections) {
      if (!seqByCollection.has(conn.collectionId)) {
        publishEvent(conn.userId, conn.collectionId, deletedWire).then(
          (seq) => seqByCollection.set(conn.collectionId, seq),
          (err) => log.error({ err }, "JetStream publish error"),
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
      const seq = seqByCollection.get(conn.collectionId);
      if (!seq) continue;
      this.sendBinary(connection.controller, [EventType.ITEM_DELETED, new Uint8Array(itemId), seq]);
    }
  }

  /**
   * Send a single indexed wire item event (used by /api/sync endpoint).
   */
  sendIndexedItem(
    controller: ReadableStreamDefaultController<Uint8Array>,
    seq: number,
    wireEvent: StoredWireItemEvent,
    includeRef = true,
  ) {
    const [type, payload] = wireEvent;
    if (type === EventType.ITEM_CHANGED && !includeRef) {
      const [, , id, collection, changedAt, props, content] = payload as WireItem;
      const changedNoRef: WireItem = [null, null, id, collection, changedAt, props, content];
      this.sendBinary(controller, [type, changedNoRef, seq]);
      return;
    }
    // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- needed for discriminated union narrowing
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

  private pruneDeadConnections() {
    for (const connection of consumerToConnection.values()) {
      if (!this.updateConnectionHealth(connection)) {
        this.removeConnection(connection.id);
      }
    }
  }

  private updateConnectionHealth(connection: StreamConnection): boolean {
    const desiredSize = connection.controller.desiredSize;
    if (desiredSize === null) return false;

    if (desiredSize <= 0) {
      if (connection.stalledSince === null) {
        connection.stalledSince = Date.now();
        return true;
      }
      return Date.now() - connection.stalledSince <= CONNECTION_STALL_TIMEOUT_MS;
    }

    connection.stalledSince = null;
    return true;
  }

  private findConsumerConnection(userId: number, consumerId: number): StreamConnection | null {
    for (const [key, info] of consumerInfo.entries()) {
      if (info.userId === userId && info.consumerId === consumerId) {
        return consumerToConnection.get(key) ?? null;
      }
    }
    return null;
  }

  /**
   * Purge NATS events that all active consumers have acknowledged.
   */
  private async tryPurgeEvents(): Promise<void> {
    if (consumerInfo.size === 0) return;

    let minSeq = Number.POSITIVE_INFINITY;
    for (const [, info] of consumerInfo.entries()) {
      const key = `${info.userId}:${info.consumerId}`;
      const seq = consumerAckedSeq.get(key);
      if (seq == null) return; // Not all consumers have acked yet
      minSeq = Math.min(minSeq, seq);
    }

    if (minSeq > 0 && Number.isFinite(minSeq)) {
      try {
        await purgeEventsUpTo(minSeq);
      } catch (err) {
        log.error({ err }, "Failed to purge events");
      }
    }
  }
}

/**
 * Convert an Item to wire item format.
 */
export function toWireItem(
  item: UserSyncItem,
  collectionName: string,
  includeRef = true,
): WireItem {
  const wireItem: WireItem = [
    includeRef ? item.sourceType : null,
    includeRef ? item.ref : null,
    new Uint8Array(item.id),
    collectionName,
    item.changedAt,
    serializeProps(item.props as Record<string, unknown>),
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

export async function getConsumerCollectionRefPolicy(
  userId: number,
  consumerId: number,
): Promise<Map<number, boolean>> {
  const rows = await db
    .select({
      collectionId: connectionTable.collectionId,
      connectionIncludeRef: connectionTable.includeRef,
      consumerIncludeRef: consumerTable.includeRef,
      collectionIncludeRef: collectionTable.includeRef,
    })
    .from(connectionTable)
    .innerJoin(
      collectionTable,
      and(
        eq(connectionTable.userId, collectionTable.userId),
        eq(connectionTable.collectionId, collectionTable.id),
      ),
    )
    .innerJoin(
      consumerTable,
      and(
        eq(connectionTable.userId, consumerTable.userId),
        eq(connectionTable.consumerId, consumerTable.id),
      ),
    )
    .where(and(eq(connectionTable.userId, userId), eq(connectionTable.consumerId, consumerId)));

  return new Map(
    rows.map((row) => [
      row.collectionId,
      Boolean(row.connectionIncludeRef) &&
        Boolean(row.consumerIncludeRef) &&
        Boolean(row.collectionIncludeRef),
    ]),
  );
}

export async function getCollectionNamesByIds(
  collectionIds: number[],
  userId?: number,
): Promise<Map<number, string>> {
  if (collectionIds.length === 0) return new Map();

  const rows = await db
    .select({ id: collectionTable.id, name: collectionTable.name })
    .from(collectionTable)
    .where(
      userId == null
        ? inArray(collectionTable.id, collectionIds)
        : and(eq(collectionTable.userId, userId), inArray(collectionTable.id, collectionIds)),
    );
  const map = new Map<number, string>();
  for (const row of rows) {
    map.set(row.id, row.name);
  }
  return map;
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
