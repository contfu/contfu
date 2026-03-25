import { extractConnectionKey } from "$lib/server/connection-auth";
import { getStreamServer } from "$lib/server/startup";
import { ConnectionType, EventType, type CollectionSchema } from "@contfu/core";
import { createLogger } from "@contfu/svc-backend/infra/logger/index";
import { runEffectWithServices } from "@contfu/svc-backend/effect/run";
import {
  fetchAndStreamItems,
  ValidationErrorCollector,
} from "@contfu/svc-backend/features/sync/fetchAndStreamItems";
import { createIncident } from "@contfu/svc-backend/features/incidents/createIncident";
import { getSyncConfig } from "@contfu/svc-backend/features/sync/getSyncConfig";
import { collectionTable, connectionTable, flowTable, db } from "@contfu/svc-backend/infra/db/db";
import {
  getLastSequence,
  isSequenceAvailable,
  replayEvents,
} from "@contfu/svc-backend/infra/nats/event-stream";
import {
  clearSnapshotProgress,
  getSnapshotProgress,
  isSnapshotSeqAvailable,
  publishSnapshot,
  purgeConnectionSnapshot,
  replaySnapshotFrom,
  setSnapshotProgress,
} from "@contfu/svc-backend/infra/nats/snapshot-stream";
import {
  getCollectionNamesByIds,
  getConnectionCollectionIds,
  getConnectionRefPolicy,
  toWireItem,
} from "@contfu/svc-backend/infra/stream/stream-server";
import { IncidentType } from "@contfu/svc-core";
import { applyMappingsToSchema, mergeSchemaValues, type MappingRule } from "@contfu/svc-core";
import { and, eq, inArray } from "drizzle-orm";
import { pack, unpack } from "msgpackr";

const log = createLogger("sync-session");

export type AuthenticatedSyncRequest = {
  key: Buffer;
  userId: number;
  clientConnectionId: number;
  requestedFromSeq: number | null;
};

export async function authenticateSyncRequest(
  request: Request,
  url: URL,
): Promise<AuthenticatedSyncRequest | Response> {
  const server = getStreamServer();

  const auth = extractConnectionKey(url, request);
  if ("error" in auth) return auth.error;
  const { key } = auth;

  const fromParam = url.searchParams.get("from");
  const requestedFromSeq = fromParam !== null ? Number.parseInt(fromParam, 10) : null;
  if (requestedFromSeq !== null && (!Number.isFinite(requestedFromSeq) || requestedFromSeq < 0)) {
    return new Response("Invalid 'from' parameter", { status: 400 });
  }

  if (key.length < 20) {
    return new Response("Invalid key format", { status: 401 });
  }

  if (request.signal.aborted) {
    return new Response("Request aborted", { status: 499 });
  }

  const connections = await db
    .select({ userId: connectionTable.userId, id: connectionTable.id })
    .from(connectionTable)
    .where(
      and(eq(connectionTable.credentials, key), eq(connectionTable.type, ConnectionType.CLIENT)),
    )
    .limit(1);
  const connection = connections[0];
  if (!connection) {
    log.warn("Auth rejected: no matching CLIENT connection found");
    return new Response("Invalid or unknown consumer key", { status: 401 });
  }

  const authResult = await server.preAuthenticate(key);
  if (authResult.error) {
    switch (authResult.error) {
      case "E_AUTH":
        log.warn(
          { userId: connection.userId, clientConnectionId: connection.id },
          "Auth rejected by preAuthenticate: E_AUTH",
        );
        return new Response("Invalid or unknown consumer key", { status: 401 });
      default:
        log.warn(
          {
            userId: connection.userId,
            clientConnectionId: connection.id,
            error: authResult.error,
          },
          "Auth rejected by preAuthenticate",
        );
        return new Response("Authentication failed", { status: 403 });
    }
  }

  log.info(
    { userId: connection.userId, clientConnectionId: connection.id, fromSeq: requestedFromSeq },
    "Consumer authenticated",
  );

  return {
    key,
    userId: connection.userId,
    clientConnectionId: connection.id,
    requestedFromSeq,
  };
}

export async function runSyncSession({
  streamConnectionId,
  userId,
  clientConnectionId,
  requestedFromSeq,
  abortSignal,
}: {
  streamConnectionId: string;
  userId: number;
  clientConnectionId: number;
  requestedFromSeq: number | null;
  abortSignal?: AbortSignal;
}): Promise<void> {
  const server = getStreamServer();

  let fromSeq = requestedFromSeq;
  let resumeFromSnapshot = false;

  const snapshotProgress = await getSnapshotProgress(userId, clientConnectionId);
  if (snapshotProgress?.inProgress && fromSeq !== null) {
    const available = await isSnapshotSeqAvailable(userId, clientConnectionId, fromSeq);
    if (available) {
      resumeFromSnapshot = true;
    } else {
      await clearSnapshotProgress(userId, clientConnectionId);
      fromSeq = null;
    }
  } else if (snapshotProgress?.inProgress && fromSeq === null) {
    resumeFromSnapshot = true;
    fromSeq = 1;
  } else if (fromSeq !== null) {
    const available = await isSequenceAvailable(fromSeq);
    if (!available) {
      fromSeq = null;
    }
  }

  const info = server.getConnectionInfo(streamConnectionId);
  if (!info || abortSignal?.aborted) {
    return;
  }

  const snapshotStartSeq = fromSeq === null ? await getLastSequence() : 0;
  const collectionIds = await getConnectionCollectionIds(userId, clientConnectionId);
  const collectionNames = await getCollectionNamesByIds(collectionIds, userId);

  const collectionDisplayNames = new Map<number, string>();
  if (collectionIds.length > 0) {
    const colRows = await db
      .select({ id: collectionTable.id, displayName: collectionTable.displayName })
      .from(collectionTable)
      .where(and(eq(collectionTable.userId, userId), inArray(collectionTable.id, collectionIds)));
    for (const row of colRows) {
      collectionDisplayNames.set(row.id, row.displayName);
    }
  }

  if (collectionIds.length > 0) {
    const flowRows = await db
      .select({
        targetId: flowTable.targetId,
        sourceId: flowTable.sourceId,
        flowSchema: flowTable.schema,
        sourceCollectionSchema: collectionTable.schema,
        mappings: flowTable.mappings,
      })
      .from(flowTable)
      .innerJoin(collectionTable, eq(flowTable.sourceId, collectionTable.id))
      .where(and(eq(flowTable.userId, userId), inArray(flowTable.targetId, collectionIds)));

    const mergedSchemas = new Map<number, CollectionSchema>();
    for (const row of flowRows) {
      const schemaBuf = row.sourceCollectionSchema ?? row.flowSchema;
      if (!schemaBuf) continue;
      const rawSchema = unpack(schemaBuf) as CollectionSchema;
      const schema = row.mappings
        ? applyMappingsToSchema(rawSchema, unpack(row.mappings) as MappingRule[])
        : rawSchema;
      const existing = mergedSchemas.get(row.targetId);
      if (existing) {
        for (const [prop, value] of Object.entries(schema)) {
          existing[prop] = mergeSchemaValues(existing[prop] ?? 0, value);
        }
      } else {
        mergedSchemas.set(row.targetId, { ...schema });
      }
    }

    for (const colId of collectionIds) {
      if (abortSignal?.aborted) return;
      const name = collectionNames.get(colId);
      if (!name) continue;
      const displayName = collectionDisplayNames.get(colId) ?? name;
      const schema = mergedSchemas.get(colId) ?? {};
      server.sendSchemaToConnection(streamConnectionId, name, displayName, schema);
    }
  }

  if (fromSeq === null) {
    log.debug({ userId, clientConnectionId }, "Starting snapshot");
    server.sendBinaryEventToConnection(streamConnectionId, [EventType.SNAPSHOT_START]);

    await setSnapshotProgress(userId, clientConnectionId, snapshotStartSeq);
    server.setSnapshotMode(userId, clientConnectionId);

    const config = await runEffectWithServices(getSyncConfig(userId, clientConnectionId));
    const validationCollector = new ValidationErrorCollector();
    let snapshotItemCount = 0;

    for await (const item of fetchAndStreamItems(config, validationCollector)) {
      if (abortSignal?.aborted) break;
      const wireEvent: [typeof EventType.ITEM_CHANGED, ReturnType<typeof toWireItem>] = [
        EventType.ITEM_CHANGED,
        toWireItem(
          item,
          collectionNames.get(item.collection) ?? String(item.collection),
          item.includeRef,
        ),
      ];
      const seq = await publishSnapshot(userId, clientConnectionId, wireEvent);
      snapshotItemCount++;
      server.sendIndexedItemToConnection(
        streamConnectionId,
        seq,
        wireEvent,
        Boolean(item.includeRef),
      );
    }

    server.sendBinaryEventToConnection(streamConnectionId, [EventType.SNAPSHOT_END]);
    await purgeConnectionSnapshot(userId, clientConnectionId);
    await clearSnapshotProgress(userId, clientConnectionId);
    server.clearSnapshotMode(userId, clientConnectionId);
    log.debug({ userId, clientConnectionId, itemCount: snapshotItemCount }, "Snapshot complete");

    if (validationCollector.size > 0) {
      for (const group of validationCollector.getGroups()) {
        try {
          await runEffectWithServices(
            createIncident(userId, {
              flowId: group.flowId,
              type: IncidentType.ItemValidationError,
              message: `${group.total} item(s) dropped: cannot cast "${group.sourceProperty}" to ${group.cast} for "${group.property}"`,
              details: {
                property: group.property,
                cast: group.cast,
                sourceProperty: group.sourceProperty,
                totalFailed: group.total,
                sampleRefs: pack(group.samples),
              },
            }),
          );
        } catch (error) {
          log.error({ err: error }, "Failed to create validation incident");
        }
      }
    }
  }

  if (resumeFromSnapshot) {
    server.setSnapshotMode(userId, clientConnectionId);
    server.sendBinaryEventToConnection(streamConnectionId, [EventType.SNAPSHOT_START]);

    for await (const { seq, event } of replaySnapshotFrom(userId, clientConnectionId, fromSeq!)) {
      if (abortSignal?.aborted) break;
      server.sendIndexedItemToConnection(streamConnectionId, seq, event);
    }

    server.sendBinaryEventToConnection(streamConnectionId, [EventType.SNAPSHOT_END]);

    const progress = await getSnapshotProgress(userId, clientConnectionId);
    const eventsStartSeq = progress?.eventsStartSeq ?? 0;
    await purgeConnectionSnapshot(userId, clientConnectionId);
    await clearSnapshotProgress(userId, clientConnectionId);
    server.clearSnapshotMode(userId, clientConnectionId);

    fromSeq = eventsStartSeq;
  }

  const replayStartSeq = fromSeq ?? snapshotStartSeq + 1;
  if (abortSignal?.aborted) {
    return;
  }

  const replayCollectionIds = await getConnectionCollectionIds(info.userId, info.connectionId);
  const refPolicyByCollection = await getConnectionRefPolicy(info.userId, info.connectionId);

  if (replayCollectionIds.length > 0 && replayStartSeq > 0) {
    log.debug(
      { userId: info.userId, clientConnectionId: info.connectionId, fromSeq: replayStartSeq },
      "Starting replay",
    );
    for await (const { seq, collectionId, event } of replayEvents({
      fromSeq: replayStartSeq,
      userId: info.userId,
      collectionIds: replayCollectionIds,
    })) {
      if (abortSignal?.aborted) break;
      server.sendIndexedItemToConnection(
        streamConnectionId,
        seq,
        event,
        refPolicyByCollection.get(collectionId) ?? true,
      );
    }
    log.debug({ userId: info.userId, clientConnectionId: info.connectionId }, "Replay complete");
  }
}
