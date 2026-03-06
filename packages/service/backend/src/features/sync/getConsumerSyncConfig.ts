import { SourceType } from "@contfu/core";
import type { Filter, MappingRule } from "@contfu/svc-core";
import { Effect } from "effect";
import { and, eq, inArray } from "drizzle-orm";
import { unpack } from "msgpackr";
import { Crypto } from "../../effect/services/Crypto";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import {
  collectionTable,
  consumerCollectionTable,
  consumerTable,
  influxTable,
  integrationTable,
  sourceCollectionTable,
  sourceTable,
} from "../../infra/db/schema";

export interface ConsumerSyncConfig {
  userId: number;
  collectionIds: number[];
  sourceGroups: Array<{
    sourceType: SourceType;
    sourceUrl: string | null;
    credentials: Buffer | null;
    sourceCollections: Array<{
      sourceCollectionId: number;
      collectionRef: Buffer | null;
      targets: Array<{
        influxId: number;
        collectionId: number;
        filters: Filter[] | null;
        includeRef: boolean;
        mappings: MappingRule[] | null;
      }>;
    }>;
  }>;
}

/**
 * Resolves everything needed for a full consumer sync:
 * - Which collections the consumer is connected to
 * - Which influxes feed those collections (with filters)
 * - Which source collections and sources provide the data
 * - Decrypted credentials, grouped by source to minimize duplicate fetches
 */
export const getConsumerSyncConfig = (userId: number, consumerId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;
    const cryptoService = yield* Crypto;

    // 1. Get collection IDs for this consumer
    const connections = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            collectionId: consumerCollectionTable.collectionId,
            connectionIncludeRef: consumerCollectionTable.includeRef,
            consumerIncludeRef: consumerTable.includeRef,
            collectionIncludeRef: collectionTable.includeRef,
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
              eq(consumerCollectionTable.consumerId, consumerId),
            ),
          ),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const collectionIds = connections.map((c) => c.collectionId);
    if (collectionIds.length === 0) {
      return { userId, collectionIds: [], sourceGroups: [] } as ConsumerSyncConfig;
    }
    const connectionRefPolicy = new Map(
      connections.map((c) => [
        c.collectionId,
        Boolean(c.connectionIncludeRef) &&
          Boolean(c.consumerIncludeRef) &&
          Boolean(c.collectionIncludeRef),
      ]),
    );

    // 2. Get influxes for those collections
    const influxes = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: influxTable.id,
            collectionId: influxTable.collectionId,
            sourceCollectionId: influxTable.sourceCollectionId,
            filters: influxTable.filters,
            includeRef: influxTable.includeRef,
            mappings: influxTable.mappings,
          })
          .from(influxTable)
          .where(
            and(eq(influxTable.userId, userId), inArray(influxTable.collectionId, collectionIds)),
          ),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (influxes.length === 0) {
      return { userId, collectionIds, sourceGroups: [] } as ConsumerSyncConfig;
    }

    // 3. Get source collection + source info
    const sourceCollectionIds = [...new Set(influxes.map((i) => i.sourceCollectionId))];

    const sourceCollections = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            sourceCollectionId: sourceCollectionTable.id,
            sourceId: sourceCollectionTable.sourceId,
            ref: sourceCollectionTable.ref,
            sourceType: sourceTable.type,
            sourceUrl: sourceTable.url,
            credentials: sourceTable.credentials,
            integrationCredentials: integrationTable.credentials,
            sourceIncludeRef: sourceTable.includeRef,
          })
          .from(sourceCollectionTable)
          .innerJoin(
            sourceTable,
            and(
              eq(sourceCollectionTable.userId, sourceTable.userId),
              eq(sourceCollectionTable.sourceId, sourceTable.id),
            ),
          )
          .leftJoin(
            integrationTable,
            and(
              eq(sourceTable.integrationId, integrationTable.id),
              eq(sourceTable.userId, integrationTable.userId),
            ),
          )
          .where(
            and(
              eq(sourceCollectionTable.userId, userId),
              inArray(sourceCollectionTable.id, sourceCollectionIds),
            ),
          ),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    // 4. Group by source to avoid duplicate fetches
    const sourceMap = new Map<
      number,
      {
        sourceType: SourceType;
        sourceUrl: string | null;
        credentials: Buffer | null;
        sourceIncludeRef: boolean;
        sourceCollections: Map<
          number,
          {
            sourceCollectionId: number;
            collectionRef: Buffer | null;
            targets: Array<{
              influxId: number;
              collectionId: number;
              filters: Filter[] | null;
              includeRef: boolean;
              mappings: MappingRule[] | null;
            }>;
          }
        >;
      }
    >();

    for (const sc of sourceCollections) {
      let group = sourceMap.get(sc.sourceId);
      if (!group) {
        group = {
          sourceType: sc.sourceType,
          sourceUrl: sc.sourceUrl,
          credentials: sc.credentials ?? sc.integrationCredentials,
          sourceIncludeRef: sc.sourceIncludeRef,
          sourceCollections: new Map(),
        };
        sourceMap.set(sc.sourceId, group);
      }
      if (!group.sourceCollections.has(sc.sourceCollectionId)) {
        group.sourceCollections.set(sc.sourceCollectionId, {
          sourceCollectionId: sc.sourceCollectionId,
          collectionRef: sc.ref,
          targets: [],
        });
      }
    }

    // 5. Map influxes to targets
    for (const influx of influxes) {
      for (const group of sourceMap.values()) {
        const sc = group.sourceCollections.get(influx.sourceCollectionId);
        if (sc) {
          const allowByConnection = connectionRefPolicy.get(influx.collectionId) ?? true;
          const allowByInflux = influx.includeRef;
          sc.targets.push({
            influxId: influx.id,
            collectionId: influx.collectionId,
            filters: influx.filters ? (unpack(influx.filters) as Filter[]) : null,
            includeRef: Boolean(group.sourceIncludeRef) && allowByInflux && allowByConnection,
            mappings: influx.mappings ? (unpack(influx.mappings) as MappingRule[]) : null,
          });
        }
      }
    }

    // 6. Decrypt credentials and build result
    const sourceGroups: ConsumerSyncConfig["sourceGroups"] = [];
    for (const group of sourceMap.values()) {
      const decryptedCredentials = yield* cryptoService.decryptCredentials(
        userId,
        group.credentials,
      );
      sourceGroups.push({
        sourceType: group.sourceType,
        sourceUrl: group.sourceUrl,
        credentials: decryptedCredentials,
        sourceCollections: [...group.sourceCollections.values()],
      });
    }

    return { userId, collectionIds, sourceGroups } as ConsumerSyncConfig;
  }).pipe(Effect.withSpan("sync.getConsumerSyncConfig", { attributes: { userId, consumerId } }));
