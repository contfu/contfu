import { Effect, Layer } from "effect";
import { and, eq, isNotNull } from "drizzle-orm";
import { db, flowTable, collectionTable, connectionTable } from "../../infra/db/db";
import { enqueueSyncJobs } from "../sync-jobs/enqueueSyncJobs";
import { Database } from "../../effect/services/Database";
import { hasNats } from "../../infra/nats/connection";
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
  if (hasNats()) {
    await purgeConnectionSnapshot(userId, consumerId);
    await clearSnapshotProgress(userId, consumerId);
  }

  // Find source collections that feed into this target collection
  const sourceRows = await db
    .select({ sourceId: flowTable.sourceId })
    .from(flowTable)
    .where(and(eq(flowTable.userId, userId), eq(flowTable.targetId, collectionId)));

  const sourceIds = [...new Set(sourceRows.map((r) => r.sourceId as number))];
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
        eq(connectionTable.type, ConnectionType.CLIENT),
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
