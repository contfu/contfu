import {
  SyncMessageType,
  type ItemsFetchedMessage,
  type UserSyncItem,
  type WorkerToAppMessage,
} from "./messages";
import { createLogger } from "../logger/index";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { and, eq, inArray, isNotNull } from "drizzle-orm";

const log = createLogger("sync-worker-manager");

import { collectionTable, connectionTable, flowTable, db } from "../db/db";
import { ConnectionType } from "@contfu/core";
import type { ConnectionInfo } from "../types";
import { unpack } from "msgpackr";
import type { CollectionSchema } from "@contfu/core";
import { applyMappings, applyMappingsToSchema } from "../../domain/mapping-ops";
import { matchesFilters } from "../../domain/filter-matching";
import { mergeSchemaValues, type Filter, type MappingRule } from "@contfu/svc-core";
import { enqueueSyncJobs } from "../../features/sync-jobs/enqueueSyncJobs";
import { Database } from "../../effect/services/Database";
import { Effect, Layer } from "effect";
import { triggerConsumerSnapshot } from "../../features/consumers/triggerConsumerSnapshot";
import { applySchemaTransform } from "../../features/consumers/applySchemaTransform";

/**
 * Precise schema change hints derived from CMS webhook payloads (e.g. Notion's
 * `database.schema_updated`). When provided to `broadcastSchema`, the heuristic
 * rename detection in `broadcastSchemaChanges` is bypassed entirely.
 */
export interface SchemaChangeHints {
  /** Internal property names that are genuinely new (require a full CMS snapshot). */
  additions: string[];
  /** Internal property names that were removed (apply local NATS transform). */
  removals: string[];
  /** oldInternalName → newInternalName for renamed properties. */
  renames: Record<string, string>;
}

type ItemsCallback = (items: UserSyncItem[], connections: ConnectionInfo[]) => void;
type SchemaCallback = (
  userId: number,
  collectionId: number,
  name: string,
  displayName: string,
  schema: CollectionSchema,
  renames: Record<string, string>,
) => void;

export class SyncWorkerManager {
  private worker: Worker | null = null;
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((reason: unknown) => void) | null = null;
  private isReady = false;
  private itemsCallback: ItemsCallback | null = null;
  private schemaCallback: SchemaCallback | null = null;
  private lastBroadcastedSchema = new Map<
    number,
    {
      serialized: string; // JSON.stringify(merged) — change detection
      provenance: Record<string, string>; // targetName → sourceName
    }
  >();

  async start() {
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });

    const workerUrl = resolveSyncWorkerUrl();
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
    if (!this.isReady && this.readyReject) {
      this.readyReject(new Error(`Sync worker failed to start: ${error.message}`));
      this.readyResolve = null;
      this.readyReject = null;
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

    // Fan out items to target collections, applying flow filters and mappings.
    // The sync worker tags items with the source collection ID; we must re-tag them
    // with the target collection ID so broadcast() can match items to connections.
    const flows = await getFlowsFromSource(msg.userId, msg.collectionId);
    const mappedItems: UserSyncItem[] = [];
    for (const item of msg.items) {
      for (const flow of flows) {
        if (flow.filters.length > 0 && !matchesFilters(item.props, flow.filters)) continue;
        const mappedProps = flow.mappings ? applyMappings(item.props, flow.mappings) : item.props;
        mappedItems.push({ ...item, collection: flow.targetId, props: mappedProps });
      }
    }

    // Propagate items through downstream flows (target → consumer collections).
    // For multi-hop chains (source → target → consumer), items tagged with the
    // target collection ID must also be fanned out to consumer collections.
    const downstreamFlows = await getDownstreamFlows(msg.userId, targetCollectionIds);
    const snapshotLength = mappedItems.length;
    for (let i = 0; i < snapshotLength; i++) {
      const item = mappedItems[i];
      for (const df of downstreamFlows) {
        if (df.sourceId !== item.collection) continue;
        const props = df.mappings ? applyMappings(item.props, df.mappings) : item.props;
        mappedItems.push({ ...item, collection: df.targetId, props });
      }
    }

    // Include downstream consumer connections in the broadcast
    if (downstreamFlows.length > 0) {
      const downstreamTargetIds = [...new Set(downstreamFlows.map((f) => f.targetId))];
      const emptyRefPolicies = new Map(downstreamTargetIds.map((id) => [id, true]));
      const downstreamConnections = await getConnectionsForCollections(
        msg.userId,
        downstreamTargetIds,
        emptyRefPolicies,
      );
      connections.push(...downstreamConnections);
    }

    this.itemsCallback(mappedItems, connections);

    // Broadcast schema changes if callback is registered
    if (this.schemaCallback) {
      await this.broadcastSchemaChanges(msg.userId, targetCollectionIds);
    }
  }

  async broadcastSchema(
    userId: number,
    collectionId: number,
    hints?: SchemaChangeHints,
  ): Promise<void> {
    // Force re-broadcast even if merged schema is unchanged (e.g. after a CMS webhook).
    // Preserves the previous cache entry so rename detection still works.
    await this.broadcastSchemaChanges(userId, [collectionId], { force: true, hints });
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

  private async broadcastSchemaChanges(
    userId: number,
    collectionIds: number[],
    options?: { force?: boolean; hints?: SchemaChangeHints },
  ) {
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

      const merged: CollectionSchema = {};
      for (const row of flowRows) {
        const schemaBuf = row.sourceSchema ?? row.flowSchema;
        if (!schemaBuf) continue;
        const rawSchema = unpack(schemaBuf) as CollectionSchema;
        const schema = row.mappings
          ? applyMappingsToSchema(rawSchema, unpack(row.mappings) as MappingRule[])
          : rawSchema;
        for (const [prop, value] of Object.entries(schema)) {
          merged[prop] = mergeSchemaValues(merged[prop] ?? 0, value);
        }
      }

      if (Object.keys(merged).length === 0) continue;

      // Build current provenance map: targetName → sourceName (from mapping rules)
      const currentProvenance: Record<string, string> = {};
      for (const row of flowRows) {
        const schemaBuf = row.flowSchema ?? row.sourceSchema;
        if (!schemaBuf) continue;
        const rawSchema = unpack(schemaBuf) as CollectionSchema;
        if (row.mappings) {
          for (const rule of unpack(row.mappings) as MappingRule[]) {
            if (rule.source in rawSchema) {
              currentProvenance[rule.target ?? rule.source] = rule.source;
            }
          }
        } else {
          for (const key of Object.keys(rawSchema)) currentProvenance[key] = key;
        }
      }

      // Only broadcast if schema actually changed (unless forced)
      const serialized = JSON.stringify(merged);
      const previous = this.lastBroadcastedSchema.get(collectionId);
      if (!options?.force && previous?.serialized === serialized) continue;
      this.lastBroadcastedSchema.set(collectionId, { serialized, provenance: currentProvenance });

      // Fetch collection name + displayName
      const [col] = await db
        .select({ name: collectionTable.name, displayName: collectionTable.displayName })
        .from(collectionTable)
        .where(and(eq(collectionTable.userId, userId), eq(collectionTable.id, collectionId)))
        .limit(1);

      if (!col) continue;

      // Dispatch per-consumer work and detect renames.
      // Skip heuristic rename detection on first broadcast (no previous to compare against),
      // but still honour explicit webhook hints so schema changes trigger snapshots even when
      // no items have been synced yet (i.e. previous is undefined).
      // Also enter the block when force=true (e.g. new flow added): treat all keys as new so
      // triggerConsumerSnapshot fires for any connected CLIENT consumers.
      const renames: Record<string, string> = {}; // oldName → newName (for COLLECTION_SCHEMA event)
      if (options?.hints || previous || options?.force) {
        let addedKeys: string[] = [];
        let removedKeys: string[] = [];

        if (options?.hints) {
          // Precise hints from CMS webhook — bypass the heuristic entirely
          Object.assign(renames, options.hints.renames);
          addedKeys = options.hints.additions;
          removedKeys = options.hints.removals;
        } else if (previous) {
          // Heuristic rename detection via provenance comparison
          const previousSchema = JSON.parse(previous.serialized) as Record<string, number>;

          for (const [newTarget, source] of Object.entries(currentProvenance)) {
            if (newTarget in previousSchema) continue; // already existed
            for (const [prevTarget, prevSource] of Object.entries(previous.provenance)) {
              if (prevSource === source && !(prevTarget in merged)) {
                renames[prevTarget] = newTarget;
                break;
              }
            }
          }

          const renamedOldNames = new Set(Object.keys(renames));
          const renamedNewNames = new Set(Object.values(renames));
          addedKeys = Object.keys(merged).filter(
            (k) => !(k in previousSchema) && !renamedNewNames.has(k),
          );
          removedKeys = Object.keys(previousSchema).filter(
            (k) => !(k in merged) && !renamedOldNames.has(k),
          );
        } else {
          // Force broadcast with no prior state (first flow added to this collection):
          // treat all merged keys as new so triggerConsumerSnapshot fires.
          addedKeys = Object.keys(merged);
        }

        const consumers = await db
          .select({ consumerId: collectionTable.connectionId })
          .from(collectionTable)
          .innerJoin(
            connectionTable,
            and(
              eq(collectionTable.connectionId, connectionTable.id),
              eq(connectionTable.type, ConnectionType.APP),
            ),
          )
          .where(
            and(
              eq(collectionTable.userId, userId),
              eq(collectionTable.id, collectionId),
              isNotNull(collectionTable.connectionId),
            ),
          );

        for (const { consumerId } of consumers) {
          if (consumerId === null) continue;
          if (addedKeys.length > 0) {
            triggerConsumerSnapshot(userId, consumerId, collectionId).catch((err) => {
              log.error(
                { err, userId, consumerId, collectionId },
                "triggerConsumerSnapshot failed",
              );
            });
          } else if (Object.keys(renames).length > 0 || removedKeys.length > 0) {
            applySchemaTransform(
              userId,
              consumerId,
              col.name,
              collectionId,
              renames,
              removedKeys,
            ).catch((err) => {
              log.error({ err, userId, consumerId, collectionId }, "applySchemaTransform failed");
            });
          }
        }
      }

      this.schemaCallback?.(userId, collectionId, col.name, col.displayName, merged, renames);

      // Propagate schema broadcast to downstream consumer collections.
      // When a target collection's schema changes, consumers connected via
      // flows from this target also need the updated COLLECTION_SCHEMA event.
      const downstreamConsumerCols = await db
        .select({
          consumerId: connectionTable.id,
          consumerCollectionId: collectionTable.id,
          consumerName: collectionTable.name,
          consumerDisplayName: collectionTable.displayName,
        })
        .from(flowTable)
        .innerJoin(collectionTable, eq(flowTable.targetId, collectionTable.id))
        .innerJoin(
          connectionTable,
          and(
            eq(collectionTable.connectionId, connectionTable.id),
            eq(connectionTable.type, ConnectionType.APP),
          ),
        )
        .where(
          and(
            eq(flowTable.userId, userId),
            eq(flowTable.sourceId, collectionId),
            isNotNull(collectionTable.connectionId),
          ),
        );

      for (const dc of downstreamConsumerCols) {
        this.schemaCallback?.(
          userId,
          dc.consumerCollectionId,
          dc.consumerName,
          dc.consumerDisplayName,
          merged,
          renames,
        );

        if (options?.hints || previous || options?.force) {
          const addedKeys = options?.hints?.additions ?? Object.keys(merged);
          if (addedKeys.length > 0) {
            triggerConsumerSnapshot(userId, dc.consumerId, dc.consumerCollectionId).catch((err) => {
              log.error(
                { err, userId, consumerId: dc.consumerId, collectionId: dc.consumerCollectionId },
                "triggerConsumerSnapshot (downstream) failed",
              );
            });
          }
        }
      }
    }
  }
}

function resolveSyncWorkerUrl(): string {
  // The bundler (rolldown) replaces all forms of process.env.NODE_ENV at build
  // time, so we cannot use a NODE_ENV switch here. Instead, check for the
  // pre-built dist worker which only exists in Docker.
  const distPath = resolve(process.cwd(), "packages/service/sync/dist/worker.js");
  if (existsSync(distPath)) return distPath;
  return resolve(import.meta.dirname, "../../../../sync/src/worker.ts");
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
        eq(connectionTable.type, ConnectionType.APP),
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

/**
 * Returns downstream flows from target collections to consumer collections.
 * Used to propagate items through multi-hop flow chains (source → target → consumer).
 */
async function getDownstreamFlows(
  userId: number,
  targetCollectionIds: number[],
): Promise<
  { sourceId: number; targetId: number; mappings: MappingRule[] | null; filters: Filter[] }[]
> {
  if (targetCollectionIds.length === 0) return [];
  const rows = await db
    .select({
      sourceId: flowTable.sourceId,
      targetId: flowTable.targetId,
      mappings: flowTable.mappings,
      filters: flowTable.filters,
    })
    .from(flowTable)
    .innerJoin(
      collectionTable,
      and(eq(flowTable.targetId, collectionTable.id), isNotNull(collectionTable.connectionId)),
    )
    .innerJoin(
      connectionTable,
      and(
        eq(collectionTable.connectionId, connectionTable.id),
        eq(connectionTable.type, ConnectionType.APP),
      ),
    )
    .where(and(eq(flowTable.userId, userId), inArray(flowTable.sourceId, targetCollectionIds)));

  return rows.map((row) => ({
    sourceId: row.sourceId,
    targetId: row.targetId,
    mappings: row.mappings ? (unpack(row.mappings) as MappingRule[]) : null,
    filters: row.filters ? (unpack(row.filters) as Filter[]) : [],
  }));
}

/**
 * Returns the flows from a source collection with their mappings and filters.
 * Used to fan out raw source items to target collections in handleItemsFetched.
 */
async function getFlowsFromSource(
  userId: number,
  sourceCollectionId: number,
): Promise<{ targetId: number; mappings: MappingRule[] | null; filters: Filter[] }[]> {
  const rows = await db
    .select({
      targetId: flowTable.targetId,
      mappings: flowTable.mappings,
      filters: flowTable.filters,
    })
    .from(flowTable)
    .where(and(eq(flowTable.userId, userId), eq(flowTable.sourceId, sourceCollectionId)));

  return rows.map((row) => ({
    targetId: row.targetId,
    mappings: row.mappings ? (unpack(row.mappings) as MappingRule[]) : null,
    filters: row.filters ? (unpack(row.filters) as Filter[]) : [],
  }));
}
