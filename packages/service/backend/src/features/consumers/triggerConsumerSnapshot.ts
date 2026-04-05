import { Effect, Layer } from "effect";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db, flowTable, collectionTable, connectionTable } from "../../infra/db/db";
import { enqueueSyncJobs } from "../sync-jobs/enqueueSyncJobs";
import { Database } from "../../effect/services/Database";
import { clearSnapshotProgress, purgeConnectionSnapshot } from "../../infra/nats/snapshot-stream";
import { ConnectionType } from "@contfu/core";

/**
 * Triggers a full CMS snapshot for a specific consumer (CLIENT connection) and collection.
 *
 * Purges the existing snapshot so the next reconnect fetches fresh data,
 * and enqueues sync jobs for source collections to push updated items
 * to connected consumers via the event stream.
 */
export async function triggerConsumerSnapshot(
  userId: number,
  consumerId: number,
  collectionId: number,
): Promise<void> {
  await purgeConnectionSnapshot(userId, consumerId);
  await clearSnapshotProgress(userId, consumerId);

  // Find source collections that feed into this target collection,
  // walking upstream through multi-hop flow chains until reaching
  // CMS-connected source collections.
  const sourceRows = await db
    .select({ sourceId: flowTable.sourceId })
    .from(flowTable)
    .where(and(eq(flowTable.userId, userId), eq(flowTable.targetId, collectionId)));

  let sourceIds = [...new Set(sourceRows.map((r) => r.sourceId))];

  // Check which sources have CMS connections; walk further upstream for those that don't.
  if (sourceIds.length > 0) {
    const withConnection = await db
      .select({ id: collectionTable.id })
      .from(collectionTable)
      .where(
        and(
          eq(collectionTable.userId, userId),
          inArray(collectionTable.id, sourceIds),
          isNotNull(collectionTable.connectionId),
        ),
      );
    const cmsIds = new Set(withConnection.map((r) => r.id));
    const nonCmsIds = sourceIds.filter((id) => !cmsIds.has(id));

    if (nonCmsIds.length > 0) {
      const upstreamRows = await db
        .select({ sourceId: flowTable.sourceId })
        .from(flowTable)
        .where(and(eq(flowTable.userId, userId), inArray(flowTable.targetId, nonCmsIds)));
      const upstreamIds = upstreamRows.map((r) => r.sourceId);
      sourceIds = [...cmsIds, ...new Set(upstreamIds)];
    }
  }

  if (sourceIds.length === 0) return;

  await Effect.runPromise(
    enqueueSyncJobs(sourceIds).pipe(
      Effect.provide(Layer.succeed(Database)({ db, withUserContext: (_, e) => e })),
    ),
  );
}

/**
 * Looks up the CLIENT consumer for a collection and triggers a full snapshot.
 * No-op if the collection has no CLIENT connection attached.
 */
export async function triggerSnapshotForCollection(
  userId: number,
  collectionId: number,
): Promise<void> {
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
    await triggerConsumerSnapshot(userId, consumerId, collectionId);
  }
}
