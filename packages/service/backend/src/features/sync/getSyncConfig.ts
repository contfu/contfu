import { ConnectionType } from "@contfu/core";
import type { Filter, MappingRule } from "@contfu/svc-core";
import { Effect } from "effect";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { pack, unpack } from "msgpackr";
import { Crypto } from "../../effect/services/Crypto";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { collectionTable, connectionTable, flowTable } from "../../infra/db/schema";

/**
 * Compose two mapping chains: apply upstream mappings, then downstream mappings.
 * If downstream is null, returns upstream as-is (pass-through).
 */
function composeMappingChain(
  upstream: MappingRule[] | null,
  downstream: MappingRule[] | null,
): MappingRule[] | null {
  if (!downstream) return upstream;
  if (!upstream) return downstream;

  const composed: MappingRule[] = [];
  for (const ds of downstream) {
    // Find upstream rule whose output matches this downstream rule's input
    const us = upstream.find((u) => (u.target ?? u.source) === ds.source);
    if (us) {
      composed.push({
        source: us.source,
        target: ds.target ?? ds.source,
        cast: ds.cast ?? us.cast,
      });
    } else {
      composed.push(ds);
    }
  }
  return composed.length > 0 ? composed : null;
}

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

    // 3.5 Multi-hop resolution: when a source collection has no CMS connection
    // (e.g. an intermediate target collection), walk one level upstream to find
    // the real CMS-connected sources and compose mappings along the chain.
    const cmsSourceIds = new Set(sourceCollections.map((sc) => sc.collectionId));
    const nonCmsSourceIds = sourceCollectionIds.filter((id) => !cmsSourceIds.has(id));

    if (nonCmsSourceIds.length > 0) {
      // Find upstream flows feeding the intermediate collections
      const upstreamFlows = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              id: flowTable.id,
              sourceId: flowTable.sourceId,
              targetId: flowTable.targetId,
              mappings: flowTable.mappings,
              filters: flowTable.filters,
              includeRef: flowTable.includeRef,
            })
            .from(flowTable)
            .where(and(eq(flowTable.userId, userId), inArray(flowTable.targetId, nonCmsSourceIds))),
        catch: (e) => new DatabaseError({ cause: e }),
      });

      if (upstreamFlows.length > 0) {
        const upstreamSourceIds = [...new Set(upstreamFlows.map((f) => f.sourceId))];

        // Find CMS-connected sources for upstream flows
        const upstreamSources = yield* Effect.tryPromise({
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
                  inArray(collectionTable.id, upstreamSourceIds),
                  isNotNull(collectionTable.connectionId),
                ),
              ),
          catch: (e) => new DatabaseError({ cause: e }),
        });

        // Add upstream CMS sources
        sourceCollections.push(...upstreamSources);

        // Create composed flows: upstream source → consumer target
        // For each upstream flow, find downstream flows it feeds into
        for (const uf of upstreamFlows) {
          const downstreamFlows = flows.filter((f) => f.sourceId === uf.targetId);
          for (const df of downstreamFlows) {
            const upMappings: MappingRule[] | null = uf.mappings
              ? (unpack(uf.mappings) as MappingRule[])
              : null;
            const downMappings: MappingRule[] | null = df.mappings
              ? (unpack(df.mappings) as MappingRule[])
              : null;
            const composed = composeMappingChain(upMappings, downMappings);
            const upFilters: Filter[] | null = uf.filters ? (unpack(uf.filters) as Filter[]) : null;
            const downFilters: Filter[] | null = df.filters
              ? (unpack(df.filters) as Filter[])
              : null;
            const mergedFilters =
              upFilters || downFilters ? [...(upFilters ?? []), ...(downFilters ?? [])] : null;

            flows.push({
              id: uf.id,
              sourceId: uf.sourceId,
              targetId: df.targetId,
              mappings: composed ? pack(composed) : null,
              filters: mergedFilters ? pack(mergedFilters) : null,
              includeRef: uf.includeRef && df.includeRef,
            });
          }
        }
      }
    }

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
