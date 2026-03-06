import {
  SyncMessageType,
  type ItemsFetchedMessage,
  type UserSyncItem,
  type WorkerToAppMessage,
} from "./messages";
import { createLogger } from "../logger/index";
import { and, eq } from "drizzle-orm";

const log = createLogger("sync-worker-manager");

import {
  collectionTable,
  consumerCollectionTable,
  consumerTable,
  db,
  influxTable,
  sourceCollectionTable,
  sourceTable,
} from "../db/db";
import type { ConnectionInfo } from "../types";
import { unpack } from "msgpackr";
import type { CollectionSchema } from "@contfu/core";
import { applyMappingsToSchema, type MappingRule } from "@contfu/svc-core";
import { enqueueSyncJobs } from "../../features/sync-jobs/enqueueSyncJobs";
import { Effect } from "effect";

type ItemsCallback = (items: UserSyncItem[], connections: ConnectionInfo[]) => void;
type SchemaCallback = (
  userId: number,
  collectionId: number,
  name: string,
  displayName: string,
  schema: Record<string, number>,
) => void;

export class SyncWorkerManager {
  private worker: Worker | null = null;
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private isReady = false;
  private itemsCallback: ItemsCallback | null = null;
  private schemaCallback: SchemaCallback | null = null;
  private lastBroadcastedSchema = new Map<number, string>();

  async start() {
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });

    const workerUrl =
      process.env.SYNC_WORKER_PATH ??
      new URL("../../../../sync/src/worker.ts", import.meta.url).href;
    this.worker = new Worker(workerUrl, { type: "module" });

    this.worker.onmessage = (e) => this.handleMessage(e.data);
    this.worker.onerror = (e) => this.handleWorkerError(e);

    await this.readyPromise;
    log.info("Sync worker started");
  }

  // eslint-disable-next-line typescript/require-await -- must return Promise for Effect.tryPromise
  async stop() {
    if (!this.worker) return;
    this.worker.postMessage({ type: SyncMessageType.SHUTDOWN });
    const worker = this.worker;
    this.worker = null;
    this.isReady = false;
    setTimeout(() => worker.terminate(), 100);
  }

  private handleWorkerError(error: ErrorEvent) {
    log.error({ err: error }, "Worker error");

    // If worker crashes before ready, reject the ready promise
    if (!this.isReady && this.readyResolve) {
      this.readyResolve = null;
    }
  }

  onItems(callback: ItemsCallback) {
    this.itemsCallback = callback;
  }

  onSchema(callback: SchemaCallback) {
    this.schemaCallback = callback;
  }

  private async handleMessage(msg: WorkerToAppMessage) {
    switch (msg.type) {
      case SyncMessageType.WORKER_READY:
        // Guard against multiple WORKER_READY messages
        if (!this.isReady && this.readyResolve) {
          this.isReady = true;
          this.readyResolve();
          this.readyResolve = null;
        }
        break;

      case SyncMessageType.ITEMS_FETCHED:
        await this.handleItemsFetched(msg);
        break;

      default:
        log.warn({ messageType: (msg as { type: number }).type }, "Unknown worker message type");
    }
  }

  private async handleItemsFetched(msg: ItemsFetchedMessage) {
    if (!this.itemsCallback || msg.items.length === 0) return;

    log.info(
      {
        itemCount: msg.items.length,
        userId: msg.userId,
        sourceCollectionId: msg.sourceCollectionId,
      },
      "Items received from worker",
    );

    // Look up which collections receive items from this source collection (via influx)
    const collectionIds = await getCollectionIdsForSourceCollection(
      msg.userId,
      msg.sourceCollectionId,
    );
    const collectionRefPolicies = await getCollectionRefPolicies(
      msg.userId,
      msg.sourceCollectionId,
      collectionIds,
    );

    // Get connections for those collections
    const connections = await getConnectionsForCollections(
      msg.userId,
      collectionIds,
      collectionRefPolicies,
    );
    this.itemsCallback(msg.items, connections);

    // Broadcast schema changes if callback is registered
    if (this.schemaCallback) {
      await this.broadcastSchemaChanges(msg.userId, collectionIds);
    }
  }

  async broadcastSchema(userId: number, collectionId: number): Promise<void> {
    // Force re-broadcast by clearing the cached schema for this collection
    this.lastBroadcastedSchema.delete(collectionId);

    // Broadcast updated COLLECTION_SCHEMA to all connected consumers
    await this.broadcastSchemaChanges(userId, [collectionId]);
  }

  async resyncSourceCollections(sourceCollectionIds: number[]): Promise<void> {
    if (sourceCollectionIds.length > 0) {
      await Effect.runPromise(enqueueSyncJobs(db, sourceCollectionIds));
    }
  }

  private async broadcastSchemaChanges(userId: number, collectionIds: number[]) {
    for (const collectionId of collectionIds) {
      // Compute merged schema (same pattern as /api/sync)
      const influxRows = await db
        .select({
          influxSchema: influxTable.schema,
          sourceSchema: sourceCollectionTable.schema,
          mappings: influxTable.mappings,
        })
        .from(influxTable)
        .innerJoin(
          sourceCollectionTable,
          eq(influxTable.sourceCollectionId, sourceCollectionTable.id),
        )
        .where(and(eq(influxTable.userId, userId), eq(influxTable.collectionId, collectionId)));

      const merged: Record<string, number> = {};
      for (const row of influxRows) {
        const schemaBuf = row.influxSchema ?? row.sourceSchema;
        if (!schemaBuf) continue;
        const rawSchema = unpack(schemaBuf) as CollectionSchema;
        const schema = row.mappings
          ? applyMappingsToSchema(rawSchema, unpack(row.mappings) as MappingRule[])
          : rawSchema;
        for (const [prop, type] of Object.entries(schema)) {
          merged[prop] = (merged[prop] ?? 0) | type;
        }
      }

      if (Object.keys(merged).length === 0) continue;

      // Only broadcast if schema actually changed
      const serialized = JSON.stringify(merged);
      if (this.lastBroadcastedSchema.get(collectionId) === serialized) continue;
      this.lastBroadcastedSchema.set(collectionId, serialized);

      // Fetch collection name + displayName
      const [col] = await db
        .select({ name: collectionTable.name, displayName: collectionTable.displayName })
        .from(collectionTable)
        .where(and(eq(collectionTable.userId, userId), eq(collectionTable.id, collectionId)))
        .limit(1);

      if (col) {
        this.schemaCallback!(userId, collectionId, col.name, col.displayName, merged);
      }
    }
  }
}

async function getCollectionIdsForSourceCollection(
  userId: number,
  sourceCollectionId: number,
): Promise<number[]> {
  const rows = await db
    .selectDistinct({ collectionId: influxTable.collectionId })
    .from(influxTable)
    .where(
      and(eq(influxTable.userId, userId), eq(influxTable.sourceCollectionId, sourceCollectionId)),
    );
  return rows.map((r) => r.collectionId);
}

async function getConnectionsForCollections(
  userId: number,
  collectionIds: number[],
  collectionRefPolicies: Map<number, boolean>,
): Promise<ConnectionInfo[]> {
  if (collectionIds.length === 0) return [];
  const results: ConnectionInfo[] = [];
  for (const collectionId of collectionIds) {
    const connections = await db
      .select({
        userId: consumerCollectionTable.userId,
        consumerId: consumerCollectionTable.consumerId,
        collectionId: consumerCollectionTable.collectionId,
        includeRef: consumerCollectionTable.includeRef,
        consumerIncludeRef: consumerTable.includeRef,
        collectionIncludeRef: collectionTable.includeRef,
        lastItemChanged: consumerCollectionTable.lastItemChanged,
      })
      .from(consumerCollectionTable)
      .innerJoin(
        collectionTable,
        and(
          eq(consumerCollectionTable.userId, collectionTable.userId),
          eq(consumerCollectionTable.collectionId, collectionTable.id),
        ),
      )
      .innerJoin(
        consumerTable,
        and(
          eq(consumerCollectionTable.userId, consumerTable.userId),
          eq(consumerCollectionTable.consumerId, consumerTable.id),
        ),
      )
      .where(
        and(
          eq(consumerCollectionTable.userId, userId),
          eq(consumerCollectionTable.collectionId, collectionId),
        ),
      );
    for (const c of connections) {
      results.push({
        userId: c.userId,
        consumerId: c.consumerId,
        collectionId: c.collectionId,
        includeRef:
          Boolean(c.includeRef) &&
          Boolean(c.consumerIncludeRef) &&
          Boolean(c.collectionIncludeRef) &&
          (collectionRefPolicies.get(c.collectionId) ?? true),
        lastItemChanged: c.lastItemChanged,
      });
    }
  }
  return results;
}

async function getCollectionRefPolicies(
  userId: number,
  sourceCollectionId: number,
  collectionIds: number[],
): Promise<Map<number, boolean>> {
  if (collectionIds.length === 0) return new Map();

  const rows = await db
    .select({
      collectionId: influxTable.collectionId,
      influxIncludeRef: influxTable.includeRef,
      sourceIncludeRef: sourceTable.includeRef,
      collectionIncludeRef: collectionTable.includeRef,
    })
    .from(influxTable)
    .innerJoin(
      collectionTable,
      and(
        eq(influxTable.userId, collectionTable.userId),
        eq(influxTable.collectionId, collectionTable.id),
      ),
    )
    .innerJoin(
      sourceCollectionTable,
      and(
        eq(influxTable.userId, sourceCollectionTable.userId),
        eq(influxTable.sourceCollectionId, sourceCollectionTable.id),
      ),
    )
    .innerJoin(
      sourceTable,
      and(
        eq(sourceCollectionTable.userId, sourceTable.userId),
        eq(sourceCollectionTable.sourceId, sourceTable.id),
      ),
    )
    .where(
      and(eq(influxTable.userId, userId), eq(influxTable.sourceCollectionId, sourceCollectionId)),
    );

  const policies = new Map<number, boolean>();
  for (const collectionId of collectionIds) policies.set(collectionId, true);

  for (const row of rows) {
    const prev = policies.get(row.collectionId) ?? true;
    const allow =
      Boolean(row.sourceIncludeRef) &&
      Boolean(row.influxIncludeRef) &&
      Boolean(row.collectionIncludeRef);
    policies.set(row.collectionId, prev && allow);
  }

  return policies;
}
