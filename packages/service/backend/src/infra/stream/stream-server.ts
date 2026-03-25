import {
  ConnectionType,
  EventType,
  type CollectionSchema,
  type WireEvent,
  type WireItem,
  type WireItemEvent,
} from "@contfu/core";
import { and, eq, inArray } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { pack as msgpack } from "msgpackr";
import { enqueueSyncJobs } from "../../features/sync-jobs/enqueueSyncJobs";
import { Database } from "../../effect/services/Database";
import { collectionTable, connectionTable, flowTable, db } from "../db/db";
import { createLogger } from "../logger/index";
import { publishEvent, purgeEventsUpTo, type StoredWireItemEvent } from "../nats/event-stream";
import { updateSnapshotAckedSeq } from "../nats/snapshot-stream";
import { addItems, isItemQuotaExceeded } from "../nats/quota-kv";
import type { UserSyncItem } from "../sync-worker/messages";
import type { ConnectionInfo } from "../types";

const log = createLogger("stream");

/**
 * Binary stream connection object that wraps a ReadableStreamDefaultController.
 */
type StreamConnection = {
  id: string;
  transport:
    | {
        kind: "http";
        controller: ReadableStreamDefaultController<Uint8Array>;
      }
    | {
        kind: "websocket";
        socket: Bun.ServerWebSocket<{
          streamConnectionId?: string;
        }>;
        lastPongAt: number;
      };
  stalledSince: number | null;
};

function isHttpController(
  target: ReadableStreamDefaultController<Uint8Array> | StreamConnection,
): target is ReadableStreamDefaultController<Uint8Array> {
  return typeof (target as ReadableStreamDefaultController<Uint8Array>).enqueue === "function";
}

function isHttpTransport(
  target:
    | ReadableStreamDefaultController<Uint8Array>
    | Bun.ServerWebSocket<{ streamConnectionId?: string }>,
): target is ReadableStreamDefaultController<Uint8Array> {
  return typeof (target as ReadableStreamDefaultController<Uint8Array>).enqueue === "function";
}

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
/** Maps stream connection ID to consumer key (hex). */
const connectionToConsumer = new Map<string, string>();
/** Maps consumer key (hex) to connection info (connectionId = CLIENT connection id). */
const consumerInfo = new Map<string, { userId: number; connectionId: number }>();
/** Temporary cache for pre-authenticated consumers (expires after 30s). */
const preAuthCache = new Map<
  string,
  { client: { id: number; userId: number }; timestamp: number }
>();
const PRE_AUTH_TTL_MS = 30 * 1000;
const CONNECTION_STALL_TIMEOUT_MS = 60 * 1000;
const HEALTH_CHECK_INTERVAL_MS = 30 * 1000;
/** Maps "userId:connectionId" to last acked sequence number. */
const connectionAckedSeq = new Map<string, number>();

/** Tracks connections currently receiving snapshot data (not events). */
const snapshotModeConnections = new Set<string>();

export class StreamServer {
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.healthCheckTimer = setInterval(
      () => this.pruneDeadConnections(),
      HEALTH_CHECK_INTERVAL_MS,
    );
  }

  shutdown(): void {
    if (this.healthCheckTimer !== null) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  setSnapshotMode(userId: number, connectionId: number): void {
    snapshotModeConnections.add(`${userId}:${connectionId}`);
  }

  clearSnapshotMode(userId: number, connectionId: number): void {
    snapshotModeConnections.delete(`${userId}:${connectionId}`);
  }

  isInSnapshotMode(userId: number, connectionId: number): boolean {
    return snapshotModeConnections.has(`${userId}:${connectionId}`);
  }

  /**
   * Returns true when the given connection currently has a live stream connection.
   */
  isConnectionActive(userId: number, connectionId: number): boolean {
    this.pruneDeadConnections();
    return this.findConnectionStream(userId, connectionId) !== null;
  }

  /**
   * Records the last-acked sequence for a connection and attempts to purge
   * events that all active connections have acknowledged.
   */
  async ackConnectionSequence(userId: number, connectionId: number, seq: number): Promise<void> {
    if (this.isInSnapshotMode(userId, connectionId)) {
      await updateSnapshotAckedSeq(userId, connectionId, seq);
      return;
    }
    const key = `${userId}:${connectionId}`;
    connectionAckedSeq.set(key, seq);
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
    transport:
      | ReadableStreamDefaultController<Uint8Array>
      | Bun.ServerWebSocket<{ streamConnectionId?: string }>,
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
      transport: isHttpTransport(transport)
        ? {
            kind: "http",
            controller: transport,
          }
        : {
            kind: "websocket",
            socket: transport,
            lastPongAt: Date.now(),
          },
      stalledSince: null,
    };

    try {
      consumerToConnection.set(consumerKey, connection);
      connectionToConsumer.set(connectionId, consumerKey);
      consumerInfo.set(consumerKey, { userId: client.userId, connectionId: client.id });
      if (connection.transport.kind === "websocket") {
        connection.transport.socket.data.streamConnectionId = connectionId;
      }

      // Enqueue sync jobs for source collections feeding this consumer's collections
      const collectionIds = await getConnectionCollectionIds(client.userId, client.id);
      if (collectionIds.length > 0) {
        const sourceCollectionIds = await getSourceCollectionIdsForTargets(
          client.userId,
          collectionIds,
        );
        if (sourceCollectionIds.length > 0) {
          await Effect.runPromise(
            enqueueSyncJobs(sourceCollectionIds).pipe(
              Effect.provide(Layer.succeed(Database)({ db, withUserContext: (_, e) => e })),
            ),
          );
        }
      }

      log.info(
        {
          userId: client.userId,
          clientConnectionId: client.id,
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
   * Get the connection info (userId, connectionId) for a given stream connection ID.
   */
  getConnectionInfo(streamConnectionId: string): { userId: number; connectionId: number } | null {
    const consumerKey = connectionToConsumer.get(streamConnectionId);
    if (!consumerKey) return null;
    return consumerInfo.get(consumerKey) ?? null;
  }

  /**
   * Removes a stream connection and cleans up resources.
   */
  removeConnection(streamConnectionId: string) {
    const consumerKey = connectionToConsumer.get(streamConnectionId);
    if (!consumerKey) return;
    const info = consumerInfo.get(consumerKey);
    log.debug(
      {
        connectionId: streamConnectionId,
        userId: info?.userId,
        clientConnectionId: info?.connectionId,
        activeConnections: consumerToConnection.size - 1,
      },
      "Connection removed",
    );

    connectionToConsumer.delete(streamConnectionId);
    consumerToConnection.delete(consumerKey);
    consumerInfo.delete(consumerKey);
    if (info) {
      connectionAckedSeq.delete(`${info.userId}:${info.connectionId}`);
      snapshotModeConnections.delete(`${info.userId}:${info.connectionId}`);
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
    schema: CollectionSchema,
  ) {
    this.sendBinary(controller, [EventType.COLLECTION_SCHEMA, collectionName, displayName, schema]);
  }

  sendSchemaToConnection(
    streamConnectionId: string,
    collectionName: string,
    displayName: string,
    schema: CollectionSchema,
  ) {
    const connection = this.findConnectionById(streamConnectionId);
    if (!connection) return;
    this.sendBinary(connection, [EventType.COLLECTION_SCHEMA, collectionName, displayName, schema]);
  }

  /**
   * Broadcast an arbitrary wire event to all active consumers connected to a
   * specific collection of a given user.
   */
  async broadcastToCollection(userId: number, collectionId: number, wireEvent: WireEvent) {
    this.pruneDeadConnections();
    for (const [consumerKey, info] of consumerInfo.entries()) {
      if (info.userId !== userId) continue;
      const collectionIds = await getConnectionCollectionIds(userId, info.connectionId);
      if (!collectionIds.includes(collectionId)) continue;
      const connection = consumerToConnection.get(consumerKey);
      if (!connection) continue;
      try {
        this.sendBinary(connection, wireEvent);
      } catch {
        this.removeConnection(connection.id);
      }
    }
  }

  /**
   * Send a wire event to a specific connection's active stream.
   */
  sendToConnection(userId: number, connectionId: number, wireEvent: WireEvent) {
    this.pruneDeadConnections();
    const connection = this.findConnectionStream(userId, connectionId);
    if (!connection) return;
    try {
      this.sendBinary(connection, wireEvent);
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
      if (connection.transport.kind === "http") {
        this.sendBinary(connection, [EventType.PING]);
      } else {
        connection.transport.socket.ping();
      }
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

  sendBinaryEventToConnection(streamConnectionId: string, wireEvent: WireEvent) {
    const connection = this.findConnectionById(streamConnectionId);
    if (!connection) return;
    this.sendBinary(connection, wireEvent);
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
        if (info.userId === conn.userId && info.connectionId === conn.connectionId) {
          connection = consumerToConnection.get(key);
          break;
        }
      }
      if (!connection) continue;

      const collectionKey = `${conn.userId}:${conn.collectionId}`;
      const changedItems = collectionItems.get(collectionKey);
      if (!changedItems) continue;

      for (const item of changedItems) {
        const collectionName =
          collectionNameById.get(conn.collectionId) ?? String(conn.collectionId);
        const wireItem = toWireItem(item, collectionName, conn.includeRef);
        const seq = itemSequences.get(item);
        if (seq == null) continue;
        this.sendBinary(connection, [EventType.ITEM_CHANGED, wireItem, seq]);
      }
    }
  }

  /**
   * Broadcasts DELETED events to connected stream consumers.
   * Also publishes the delete event to JetStream.
   */
  broadcastDeleted(itemId: Buffer, connections: ConnectionInfo[]) {
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
        if (info.userId === conn.userId && info.connectionId === conn.connectionId) {
          connection = consumerToConnection.get(key);
          break;
        }
      }
      if (!connection) continue;
      const seq = seqByCollection.get(conn.collectionId);
      if (seq == null) continue;
      this.sendBinary(connection, [EventType.ITEM_DELETED, new Uint8Array(itemId), seq]);
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
      const [, , id, collection, changedAt, props, content] = payload;
      const changedNoRef: WireItem = [null, null, id, collection, changedAt, props, content];
      this.sendBinary(controller, [type, changedNoRef, seq]);
      return;
    }
    // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- needed for discriminated union narrowing
    this.sendBinary(controller, [type, payload, seq] as WireItemEvent);
  }

  sendIndexedItemToConnection(
    streamConnectionId: string,
    seq: number,
    wireEvent: StoredWireItemEvent,
    includeRef = true,
  ) {
    const connection = this.findConnectionById(streamConnectionId);
    if (!connection) return;
    const [type, payload] = wireEvent;
    if (type === EventType.ITEM_CHANGED && !includeRef) {
      const [, , id, collection, changedAt, props, content] = payload;
      const changedNoRef: WireItem = [null, null, id, collection, changedAt, props, content];
      this.sendBinary(connection, [type, changedNoRef, seq]);
      return;
    }
    this.sendBinary(connection, [type, payload, seq] as WireItemEvent);
  }

  markConnectionPong(streamConnectionId: string): void {
    const connection = this.findConnectionById(streamConnectionId);
    if (!connection || connection.transport.kind !== "websocket") return;
    connection.transport.lastPongAt = Date.now();
  }

  /**
   * Sends a binary message with length prefix.
   * Format: [4-byte big-endian length][msgpack data]
   */
  private sendBinary(
    target: ReadableStreamDefaultController<Uint8Array> | StreamConnection,
    wireEvent: WireEvent,
  ) {
    const connection = isHttpController(target) ? null : target;
    const encoded = msgpack(wireEvent);

    if (connection?.transport.kind === "websocket") {
      const status = connection.transport.socket.sendBinary(encoded);
      if (status <= 0) {
        throw new Error("WebSocket send failed");
      }
      return;
    }

    const controller = isHttpController(target)
      ? target
      : target.transport.kind === "http"
        ? target.transport.controller
        : null;
    if (controller === null) {
      throw new Error("Expected HTTP transport");
    }
    if (controller.desiredSize === null) return;

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
    if (connection.transport.kind === "websocket") {
      return (
        connection.transport.socket.readyState === WebSocket.OPEN &&
        Date.now() - connection.transport.lastPongAt <= CONNECTION_STALL_TIMEOUT_MS
      );
    }

    const desiredSize = connection.transport.controller.desiredSize;
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

  private findConnectionStream(userId: number, connectionId: number): StreamConnection | null {
    for (const [key, info] of consumerInfo.entries()) {
      if (info.userId === userId && info.connectionId === connectionId) {
        return consumerToConnection.get(key) ?? null;
      }
    }
    return null;
  }

  private findConnectionById(streamConnectionId: string): StreamConnection | null {
    const consumerKey = connectionToConsumer.get(streamConnectionId);
    if (!consumerKey) return null;
    return consumerToConnection.get(consumerKey) ?? null;
  }

  /**
   * Purge NATS events that all active consumers have acknowledged.
   */
  private async tryPurgeEvents(): Promise<void> {
    if (consumerInfo.size === 0) return;

    let minSeq = Number.POSITIVE_INFINITY;
    for (const [, info] of consumerInfo.entries()) {
      const key = `${info.userId}:${info.connectionId}`;
      const seq = connectionAckedSeq.get(key);
      if (seq == null) return; // Not all connections have acked yet
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

/**
 * Authenticate a consumer by looking up the key in the connection table.
 * CLIENT connections store the consumer API key in credentials.
 */
async function authenticateConsumer(key: Buffer) {
  if (key.length < 20) return null;
  const rows = await db
    .select({ id: connectionTable.id, userId: connectionTable.userId })
    .from(connectionTable)
    .where(
      and(eq(connectionTable.credentials, key), eq(connectionTable.type, ConnectionType.CLIENT)),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Get collection IDs owned by a CLIENT connection.
 */
export async function getConnectionCollectionIds(
  userId: number,
  connectionId: number,
): Promise<number[]> {
  const rows = await db
    .select({ id: collectionTable.id })
    .from(collectionTable)
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.connectionId, connectionId)));
  return rows.map((r) => r.id);
}

/**
 * Get the ref policy for collections owned by a CLIENT connection.
 * Combines connection.includeRef and collection.includeRef.
 */
export async function getConnectionRefPolicy(
  userId: number,
  connectionId: number,
): Promise<Map<number, boolean>> {
  const rows = await db
    .select({
      collectionId: collectionTable.id,
      connectionIncludeRef: connectionTable.includeRef,
      collectionIncludeRef: collectionTable.includeRef,
    })
    .from(collectionTable)
    .innerJoin(connectionTable, eq(collectionTable.connectionId, connectionTable.id))
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.connectionId, connectionId)));

  return new Map(
    rows.map((row) => [
      row.collectionId,
      Boolean(row.connectionIncludeRef) && Boolean(row.collectionIncludeRef),
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

/**
 * Given target collection IDs, find the source collection IDs via flows.
 */
async function getSourceCollectionIdsForTargets(
  userId: number,
  targetCollectionIds: number[],
): Promise<number[]> {
  if (targetCollectionIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ sourceId: flowTable.sourceId })
    .from(flowTable)
    .where(and(eq(flowTable.userId, userId), inArray(flowTable.targetId, targetCollectionIds)));
  return rows.map((r) => r.sourceId);
}
