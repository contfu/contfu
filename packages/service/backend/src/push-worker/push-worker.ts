import { Effect } from "effect";
import { EventType, ConnectionType, type WireItem, type CollectionSchema } from "@contfu/core";
import { writeItemToNotion } from "@contfu/svc-sources/notion";
import { eq } from "drizzle-orm";
import { unpack } from "msgpackr";
import { createLogger } from "../infra/logger/index";
import { db } from "../infra/db/db";
import { connectionTable, collectionTable, flowTable } from "../infra/db/schema";
import { decryptCredentials } from "../infra/crypto/credentials";
import { getJetStreamManager } from "../infra/nats/jsm";
import { pushConsumerName, setupPushConsumer } from "../infra/nats/push-consumers";
import type { StoredWireItemEvent } from "../infra/nats/event-stream";

const log = createLogger("push-worker");

const STREAM_NAME = "events";

type ServiceConnectionInfo = {
  id: number;
  userId: number;
};

type CollectionInfo = {
  connectionId: number;
  collectionId: number;
  schema: Buffer | null;
  ref: Buffer | null;
};

/**
 * Load all service connections (non-CLIENT, e.g. NOTION) with their target collections
 * in a single JOIN query.
 */
async function loadServiceConsumers(): Promise<
  {
    connection: ServiceConnectionInfo;
    collections: CollectionInfo[];
  }[]
> {
  const rows = await db
    .selectDistinct({
      connectionId: connectionTable.id,
      userId: connectionTable.userId,
      collectionId: collectionTable.id,
      schema: collectionTable.schema,
      ref: collectionTable.ref,
    })
    .from(connectionTable)
    .innerJoin(collectionTable, eq(collectionTable.connectionId, connectionTable.id))
    .innerJoin(flowTable, eq(flowTable.targetId, collectionTable.id))
    .where(eq(connectionTable.type, ConnectionType.NOTION));

  // Group by connection
  const grouped = new Map<
    number,
    { connection: ServiceConnectionInfo; collections: CollectionInfo[] }
  >();

  for (const row of rows) {
    let entry = grouped.get(row.connectionId);
    if (!entry) {
      entry = {
        connection: { id: row.connectionId, userId: row.userId },
        collections: [],
      };
      grouped.set(row.connectionId, entry);
    }
    entry.collections.push({
      connectionId: row.connectionId,
      collectionId: row.collectionId,
      schema: row.schema,
      ref: row.ref,
    });
  }

  return Array.from(grouped.values());
}

/**
 * Process a single push message for a service connection + collection.
 */
async function processPushMessage(
  connection: ServiceConnectionInfo,
  collectionId: number,
  schema: Buffer | null,
  ref: Buffer | null,
  msg: { data: Uint8Array; ack(): void; nak(): void },
): Promise<void> {
  try {
    const [eventType, wireItem] = unpack(msg.data) as StoredWireItemEvent;

    if (eventType !== EventType.ITEM_CHANGED) {
      // Ignore deletes and other events for now
      msg.ack();
      return;
    }

    const [sourceType, refUrl, , , , props] = wireItem;

    // Only process Notion-sourced items for now
    if (sourceType !== null && sourceType !== ConnectionType.NOTION) {
      msg.ack();
      return;
    }

    // Get the collection schema
    const collectionSchema = schema ? (unpack(schema) as CollectionSchema) : {};

    // Get the Notion database ID from the collection's ref
    if (!ref) {
      log.warn(
        { connectionId: connection.id, collectionId },
        "Collection has no ref (database ID)",
      );
      msg.ack();
      return;
    }

    const databaseId = ref.toString("utf-8");

    // Fetch connection credentials
    const [conn] = await db
      .select({ credentials: connectionTable.credentials, userId: connectionTable.userId })
      .from(connectionTable)
      .where(eq(connectionTable.id, connection.id))
      .limit(1);

    if (!conn?.credentials) {
      log.warn({ connectionId: connection.id }, "Connection not found or missing credentials");
      msg.ack();
      return;
    }

    const decrypted = await decryptCredentials(connection.userId, conn.credentials);
    if (!decrypted) {
      log.warn({ connectionId: connection.id }, "Failed to decrypt connection credentials");
      msg.ack();
      return;
    }

    const token = decrypted.toString("utf-8");

    await writeItemToNotion(token, databaseId, collectionSchema, props, refUrl);

    msg.ack();
  } catch (err) {
    log.error({ err, connectionId: connection.id, collectionId }, "Error processing push message");
    msg.nak();
  }
}

/**
 * Subscribe a service connection + collection pair to its durable NATS consumer.
 */
async function subscribeToCollection(
  connection: ServiceConnectionInfo,
  collection: CollectionInfo,
): Promise<void> {
  try {
    const jsm = await getJetStreamManager();
    const name = pushConsumerName(connection.id, collection.collectionId);
    const stream = await jsm.streams.get(STREAM_NAME);
    const natsConsumer = await stream.getConsumer(name);
    const messages = await natsConsumer.consume();

    (async () => {
      for await (const msg of messages) {
        await processPushMessage(
          connection,
          collection.collectionId,
          collection.schema,
          collection.ref,
          {
            data: msg.data,
            ack: () => msg.ack(),
            nak: () => msg.nak(),
          },
        );
      }
    })().catch((err) => {
      log.error(
        { err, connectionId: connection.id, collectionId: collection.collectionId },
        "Push subscription error",
      );
    });
  } catch (err) {
    log.error(
      { err, connectionId: connection.id, collectionId: collection.collectionId },
      "Failed to subscribe to push consumer",
    );
  }
}

/**
 * Start the push worker.
 * Sets up durable NATS consumers for all existing service connections and subscribes.
 * Polls periodically for new service connections.
 */
export async function startPushWorker(): Promise<void> {
  log.info("Starting push worker");

  const subscribed = new Set<string>();

  async function ensureSubscriptions() {
    const serviceConsumers = await loadServiceConsumers();
    for (const { connection, collections } of serviceConsumers) {
      for (const collection of collections) {
        const key = `${connection.id}:${collection.collectionId}`;
        if (subscribed.has(key)) continue;
        subscribed.add(key);
        await Effect.runPromise(
          setupPushConsumer(connection.userId, connection.id, collection.collectionId),
        );
        await subscribeToCollection(connection, collection);
      }
    }
  }

  await ensureSubscriptions();
  log.info({ subscriptions: subscribed.size }, "Push worker started");

  // Poll every 30s for new service connections
  setInterval(() => {
    ensureSubscriptions().catch((err) => {
      log.error({ err }, "Error refreshing push worker subscriptions");
    });
  }, 30_000);
}
