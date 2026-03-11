import { ConnectionType } from "@contfu/core";
import type { Filter, MappingRule } from "@contfu/svc-core";
import { Effect } from "effect";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { unpack } from "msgpackr";
import { Crypto } from "../../effect/services/Crypto";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { collectionTable, connectionTable, flowTable } from "../../infra/db/schema";

export interface SyncConfig {
  userId: number;
  targetCollectionIds: number[];
  connectionGroups: Array<{
    connectionType: ConnectionType;
    connectionUrl: string | null;
    credentials: Buffer | null;
    sourceCollections: Array<{
      collectionId: number;
      collectionRef: Buffer | null;
      targets: Array<{
        flowId: number;
        targetCollectionId: number;
        filters: Filter[] | null;
        includeRef: boolean;
        mappings: MappingRule[] | null;
      }>;
    }>;
  }>;
}

/**
 * Resolves everything needed for a full sync of a CLIENT connection:
 * - Which target collections belong to the CLIENT connection
 * - Which flows feed those target collections (with filters/mappings)
 * - Which source collections and connections provide the data
 * - Decrypted credentials, grouped by source connection to minimize duplicate fetches
 */
export const getSyncConfig = (
  userId: number,
  clientConnectionId: number,
  filterCollectionIds?: number[],
) =>
  Effect.gen(function* () {
    const { db } = yield* Database;
    const cryptoService = yield* Crypto;

    // 1. Find target collections belonging to this CLIENT connection
    const targetCollections = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            collectionId: collectionTable.id,
            collectionIncludeRef: collectionTable.includeRef,
            connectionIncludeRef: connectionTable.includeRef,
          })
          .from(collectionTable)
          .innerJoin(
            connectionTable,
            and(
              eq(collectionTable.userId, connectionTable.userId),
              eq(collectionTable.connectionId, connectionTable.id),
            ),
          )
          .where(
            and(
              eq(collectionTable.userId, userId),
              eq(collectionTable.connectionId, clientConnectionId),
              filterCollectionIds ? inArray(collectionTable.id, filterCollectionIds) : undefined,
            ),
          ),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const targetCollectionIds = targetCollections.map((c) => c.collectionId);
    if (targetCollectionIds.length === 0) {
      return { userId, targetCollectionIds: [], connectionGroups: [] } as SyncConfig;
    }

    const targetRefPolicy = new Map(
      targetCollections.map((c) => [
        c.collectionId,
        Boolean(c.collectionIncludeRef) && Boolean(c.connectionIncludeRef),
      ]),
    );

    // 2. Get flows targeting those collections
    const flows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: flowTable.id,
            sourceId: flowTable.sourceId,
            targetId: flowTable.targetId,
            filters: flowTable.filters,
            includeRef: flowTable.includeRef,
            mappings: flowTable.mappings,
          })
          .from(flowTable)
          .where(
            and(eq(flowTable.userId, userId), inArray(flowTable.targetId, targetCollectionIds)),
          ),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (flows.length === 0) {
      return { userId, targetCollectionIds, connectionGroups: [] } as SyncConfig;
    }

    // 3. Get source collections with their connections (for credentials)
    const sourceCollectionIds = [...new Set(flows.map((f) => f.sourceId))];

    const sourceCollections = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            collectionId: collectionTable.id,
            connectionId: collectionTable.connectionId,
            ref: collectionTable.ref,
            connectionType: connectionTable.type,
            connectionUrl: connectionTable.url,
            credentials: connectionTable.credentials,
            connectionIncludeRef: connectionTable.includeRef,
          })
          .from(collectionTable)
          .innerJoin(
            connectionTable,
            and(
              eq(collectionTable.userId, connectionTable.userId),
              eq(collectionTable.connectionId, connectionTable.id),
            ),
          )
          .where(
            and(
              eq(collectionTable.userId, userId),
              inArray(collectionTable.id, sourceCollectionIds),
              isNotNull(collectionTable.connectionId),
            ),
          ),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    // 4. Group by source connection to avoid duplicate credential fetches
    const connectionMap = new Map<
      number,
      {
        connectionType: ConnectionType;
        connectionUrl: string | null;
        credentials: Buffer | null;
        connectionIncludeRef: boolean;
        sourceCollections: Map<
          number,
          {
            collectionId: number;
            collectionRef: Buffer | null;
            targets: Array<{
              flowId: number;
              targetCollectionId: number;
              filters: Filter[] | null;
              includeRef: boolean;
              mappings: MappingRule[] | null;
            }>;
          }
        >;
      }
    >();

    for (const sc of sourceCollections) {
      const connId = sc.connectionId!;
      let group = connectionMap.get(connId);
      if (!group) {
        group = {
          connectionType: sc.connectionType,
          connectionUrl: sc.connectionUrl,
          credentials: sc.credentials,
          connectionIncludeRef: sc.connectionIncludeRef,
          sourceCollections: new Map(),
        };
        connectionMap.set(connId, group);
      }
      if (!group.sourceCollections.has(sc.collectionId)) {
        group.sourceCollections.set(sc.collectionId, {
          collectionId: sc.collectionId,
          collectionRef: sc.ref,
          targets: [],
        });
      }
    }

    // 5. Map flows to targets
    for (const flow of flows) {
      for (const group of connectionMap.values()) {
        const sc = group.sourceCollections.get(flow.sourceId);
        if (sc) {
          const allowByTarget = targetRefPolicy.get(flow.targetId) ?? true;
          const allowByFlow = flow.includeRef;
          sc.targets.push({
            flowId: flow.id,
            targetCollectionId: flow.targetId,
            filters: flow.filters ? (unpack(flow.filters) as Filter[]) : null,
            includeRef: Boolean(group.connectionIncludeRef) && allowByFlow && allowByTarget,
            mappings: flow.mappings ? (unpack(flow.mappings) as MappingRule[]) : null,
          });
        }
      }
    }

    // 6. Decrypt credentials and build result
    const connectionGroups: SyncConfig["connectionGroups"] = [];
    for (const group of connectionMap.values()) {
      const decryptedCredentials = yield* cryptoService.decryptCredentials(
        userId,
        group.credentials,
      );
      connectionGroups.push({
        connectionType: group.connectionType,
        connectionUrl: group.connectionUrl,
        credentials: decryptedCredentials,
        sourceCollections: [...group.sourceCollections.values()],
      });
    }

    return { userId, targetCollectionIds, connectionGroups } as SyncConfig;
  }).pipe(
    Effect.withSpan("sync.getSyncConfig", {
      attributes: { userId, clientConnectionId },
    }),
  );
