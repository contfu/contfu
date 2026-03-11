import {
  SyncMessageType,
  type ItemsFetchedMessage,
  type UserSyncItem,
  type WorkerToAppMessage,
} from "./messages";
import { createLogger } from "../logger/index";
import { and, eq, inArray } from "drizzle-orm";

const log = createLogger("sync-worker-manager");

import { collectionTable, connectionTable, flowTable, db } from "../db/db";
import { ConnectionType } from "@contfu/core";
import type { ConnectionInfo } from "../types";
import { unpack } from "msgpackr";
import type { CollectionSchema } from "@contfu/core";
import { applyMappingsToSchema, type MappingRule } from "@contfu/svc-core";
import { enqueueSyncJobs } from "../../features/sync-jobs/enqueueSyncJobs";
import { Database } from "../../effect/services/Database";
import { Effect, Layer } from "effect";

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
        collectionId: msg.collectionId,
      },
      "Items received from worker",
    );

    // Look up which target collections receive items from this source collection (via flows)
    const targetCollectionIds = await getTargetCollectionIdsForSource(msg.userId, msg.collectionId);
    const flowRefPolicies = await getFlowRefPolicies(
      msg.userId,
      msg.collectionId,
      targetCollectionIds,
    );

    // Get CLIENT connections for those target collections
    const connections = await getConnectionsForCollections(
      msg.userId,
      targetCollectionIds,
      flowRefPolicies,
    );
    this.itemsCallback(msg.items, connections);

    // Broadcast schema changes if callback is registered
    if (this.schemaCallback) {
      await this.broadcastSchemaChanges(msg.userId, targetCollectionIds);
    }
  }

  async broadcastSchema(userId: number, collectionId: number): Promise<void> {
    // Force re-broadcast by clearing the cached schema for this collection
    this.lastBroadcastedSchema.delete(collectionId);

    // Broadcast updated COLLECTION_SCHEMA to all connected consumers
    await this.broadcastSchemaChanges(userId, [collectionId]);
  }

  async resyncCollections(collectionIds: number[]): Promise<void> {
    if (collectionIds.length > 0) {
      await Effect.runPromise(
        enqueueSyncJobs(collectionIds).pipe(
          Effect.provide(Layer.succeed(Database)({ db, withUserContext: (_, e) => e })),
        ),
      );
    }
  }

  private async broadcastSchemaChanges(userId: number, collectionIds: number[]) {
    for (const collectionId of collectionIds) {
      // Compute merged schema from all flows targeting this collection
      const flowRows = await db
        .select({
          flowSchema: flowTable.schema,
          sourceSchema: collectionTable.schema,
          mappings: flowTable.mappings,
        })
        .from(flowTable)
        .innerJoin(collectionTable, eq(flowTable.sourceId, collectionTable.id))
        .where(and(eq(flowTable.userId, userId), eq(flowTable.targetId, collectionId)));

      const merged: Record<string, number> = {};
      for (const row of flowRows) {
        const schemaBuf = row.flowSchema ?? row.sourceSchema;
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

async function getTargetCollectionIdsForSource(
  userId: number,
  sourceCollectionId: number,
): Promise<number[]> {
  const rows = await db
    .selectDistinct({ targetId: flowTable.targetId })
    .from(flowTable)
    .where(and(eq(flowTable.userId, userId), eq(flowTable.sourceId, sourceCollectionId)));
  return rows.map((r) => r.targetId);
}

async function getConnectionsForCollections(
  userId: number,
  collectionIds: number[],
  collectionRefPolicies: Map<number, boolean>,
): Promise<ConnectionInfo[]> {
  if (collectionIds.length === 0) return [];

  // Find CLIENT connections that own the target collections
  const rows = await db
    .select({
      connectionId: connectionTable.id,
      collectionId: collectionTable.id,
      connectionIncludeRef: connectionTable.includeRef,
      collectionIncludeRef: collectionTable.includeRef,
    })
    .from(collectionTable)
    .innerJoin(
      connectionTable,
      and(
        eq(collectionTable.connectionId, connectionTable.id),
        eq(connectionTable.type, ConnectionType.CLIENT),
      ),
    )
    .where(and(eq(collectionTable.userId, userId), inArray(collectionTable.id, collectionIds)));

  return rows.map((r) => ({
    userId,
    connectionId: r.connectionId,
    collectionId: r.collectionId,
    includeRef:
      Boolean(r.connectionIncludeRef) &&
      Boolean(r.collectionIncludeRef) &&
      (collectionRefPolicies.get(r.collectionId) ?? true),
  }));
}

async function getFlowRefPolicies(
  userId: number,
  sourceCollectionId: number,
  targetCollectionIds: number[],
): Promise<Map<number, boolean>> {
  if (targetCollectionIds.length === 0) return new Map();

  const rows = await db
    .select({
      targetId: flowTable.targetId,
      flowIncludeRef: flowTable.includeRef,
      sourceConnectionIncludeRef: connectionTable.includeRef,
      sourceCollectionIncludeRef: collectionTable.includeRef,
    })
    .from(flowTable)
    .innerJoin(collectionTable, eq(flowTable.sourceId, collectionTable.id))
    .innerJoin(connectionTable, eq(collectionTable.connectionId, connectionTable.id))
    .where(and(eq(flowTable.userId, userId), eq(flowTable.sourceId, sourceCollectionId)));

  const policies = new Map<number, boolean>();
  for (const id of targetCollectionIds) policies.set(id, true);

  for (const row of rows) {
    const prev = policies.get(row.targetId) ?? true;
    const allow =
      Boolean(row.sourceConnectionIncludeRef) &&
      Boolean(row.flowIncludeRef) &&
      Boolean(row.sourceCollectionIncludeRef);
    policies.set(row.targetId, prev && allow);
  }

  return policies;
}
