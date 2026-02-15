import type { Filter } from "@contfu/core";
import { and, eq, inArray } from "drizzle-orm";
import { unpack } from "msgpackr";
import { decryptCredentials } from "../../infra/crypto/credentials";
import {
  connectionTable,
  db,
  influxTable,
  sourceCollectionTable,
  sourceTable,
} from "../../infra/db/db";

export interface ConsumerSyncConfig {
  userId: number;
  collectionIds: number[];
  sourceGroups: Array<{
    sourceType: number;
    sourceUrl: string | null;
    credentials: Buffer | null;
    sourceCollections: Array<{
      sourceCollectionId: number;
      collectionRef: Buffer | null;
      targets: Array<{ collectionId: number; filters: Filter[] | null }>;
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
export async function getConsumerSyncConfig(
  userId: number,
  consumerId: number,
): Promise<ConsumerSyncConfig> {
  // 1. Get collection IDs for this consumer
  const connections = await db
    .select({ collectionId: connectionTable.collectionId })
    .from(connectionTable)
    .where(and(eq(connectionTable.userId, userId), eq(connectionTable.consumerId, consumerId)));

  const collectionIds = connections.map((c) => c.collectionId);
  if (collectionIds.length === 0) {
    return { userId, collectionIds: [], sourceGroups: [] };
  }

  // 2. Get influxes for those collections
  const influxes = await db
    .select({
      collectionId: influxTable.collectionId,
      sourceCollectionId: influxTable.sourceCollectionId,
      filters: influxTable.filters,
    })
    .from(influxTable)
    .where(and(eq(influxTable.userId, userId), inArray(influxTable.collectionId, collectionIds)));

  if (influxes.length === 0) {
    return { userId, collectionIds, sourceGroups: [] };
  }

  // 3. Get source collection + source info
  const sourceCollectionIds = [...new Set(influxes.map((i) => i.sourceCollectionId))];

  const sourceCollections = await db
    .select({
      sourceCollectionId: sourceCollectionTable.id,
      sourceId: sourceCollectionTable.sourceId,
      ref: sourceCollectionTable.ref,
      sourceType: sourceTable.type,
      sourceUrl: sourceTable.url,
      credentials: sourceTable.credentials,
    })
    .from(sourceCollectionTable)
    .innerJoin(
      sourceTable,
      and(
        eq(sourceCollectionTable.userId, sourceTable.userId),
        eq(sourceCollectionTable.sourceId, sourceTable.id),
      ),
    )
    .where(
      and(
        eq(sourceCollectionTable.userId, userId),
        inArray(sourceCollectionTable.id, sourceCollectionIds),
      ),
    );

  // 4. Group by source to avoid duplicate fetches
  const sourceMap = new Map<
    number,
    {
      sourceType: number;
      sourceUrl: string | null;
      credentials: Buffer | null;
      sourceCollections: Map<
        number,
        {
          sourceCollectionId: number;
          collectionRef: Buffer | null;
          targets: Array<{ collectionId: number; filters: Filter[] | null }>;
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
        credentials: sc.credentials,
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
        sc.targets.push({
          collectionId: influx.collectionId,
          filters: influx.filters ? (unpack(influx.filters) as Filter[]) : null,
        });
      }
    }
  }

  // 6. Decrypt credentials and build result
  const sourceGroups: ConsumerSyncConfig["sourceGroups"] = [];
  for (const group of sourceMap.values()) {
    const decryptedCredentials = await decryptCredentials(userId, group.credentials);
    sourceGroups.push({
      sourceType: group.sourceType,
      sourceUrl: group.sourceUrl,
      credentials: decryptedCredentials,
      sourceCollections: [...group.sourceCollections.values()],
    });
  }

  return { userId, collectionIds, sourceGroups };
}
