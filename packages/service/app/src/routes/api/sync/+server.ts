import { extractConnectionKey } from "$lib/server/connection-auth";
import { getStreamServer } from "$lib/server/startup";
import { ConnectionType, EventType } from "@contfu/core";
import { createLogger } from "@contfu/svc-backend/infra/logger/index";
import { runEffectWithServices } from "@contfu/svc-backend/effect/run";
import {
  fetchAndStreamItems,
  ValidationErrorCollector,
} from "@contfu/svc-backend/features/sync/fetchAndStreamItems";
import { createIncident } from "@contfu/svc-backend/features/incidents/createIncident";
import { IncidentType } from "@contfu/svc-core";
import { pack } from "msgpackr";
import { getSyncConfig } from "@contfu/svc-backend/features/sync/getSyncConfig";
import { collectionTable, connectionTable, flowTable, db } from "@contfu/svc-backend/infra/db/db";
import { hasNats } from "@contfu/svc-backend/infra/nats/connection";
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
import { and, eq, inArray } from "drizzle-orm";
import { unpack } from "msgpackr";
import type { CollectionSchema } from "@contfu/core";
import { applyMappingsToSchema, mergeSchemaValues, type MappingRule } from "@contfu/svc-core";
import type { RequestHandler } from "./$types";

const log = createLogger("api-sync");

export const GET: RequestHandler = async ({ request, url }) => {
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

  // Authenticate by finding the CLIENT connection with this key
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

  const clientConnectionId = connection.id;

  const authResult = await server.preAuthenticate(key);
  if (authResult.error) {
    switch (authResult.error) {
      case "E_AUTH":
        log.warn(
          { userId: connection.userId, clientConnectionId },
          "Auth rejected by preAuthenticate: E_AUTH",
        );
        return new Response("Invalid or unknown consumer key", { status: 401 });
      default:
        log.warn(
          { userId: connection.userId, clientConnectionId, error: authResult.error },
          "Auth rejected by preAuthenticate",
        );
        return new Response("Authentication failed", { status: 403 });
    }
  }

  log.info(
    { userId: connection.userId, clientConnectionId, fromSeq: requestedFromSeq },
    "Consumer connected",
  );

  let fromSeq = requestedFromSeq;
  let resumeFromSnapshot = false;

  if (hasNats()) {
    const snapshotProgress = await getSnapshotProgress(connection.userId, clientConnectionId);
    if (snapshotProgress?.inProgress && fromSeq !== null) {
      const available = await isSnapshotSeqAvailable(
        connection.userId,
        clientConnectionId,
        fromSeq,
      );
      if (available) {
        resumeFromSnapshot = true;
      } else {
        await clearSnapshotProgress(connection.userId, clientConnectionId);
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
  }

  let cleanupConnection: (() => void) | null = null;

  const stream = new ReadableStream({
    cancel() {
      cleanupConnection?.();
    },
    async start(controller) {
      let connectionId: string | null = null;
      let keepAlive: ReturnType<typeof setInterval> | null = null;
      let cleanedUp = false;

      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        if (keepAlive) {
          clearInterval(keepAlive);
          keepAlive = null;
        }
        if (connectionId) {
          log.debug({ connectionId }, "Connection closed");
          server.removeConnection(connectionId);
          connectionId = null;
        }
        try {
          controller.close();
        } catch {
          // Controller may already be closed
        }
      };
      cleanupConnection = cleanup;

      const onAbort = () => cleanup();
      request.signal.addEventListener("abort", onAbort, { once: true });

      try {
        if (request.signal.aborted) return;

        const result = await server.finalizeConnection(key, controller);
        if (typeof result !== "string") {
          cleanup();
          return;
        }
        connectionId = result;
        log.info(
          { userId: connection.userId, clientConnectionId, connectionId },
          "Connection established",
        );

        const info = server.getConnectionInfo(connectionId);
        if (!info || request.signal.aborted) {
          cleanup();
          return;
        }

        keepAlive = setInterval(() => {
          try {
            if (!connectionId || !server.sendPingForConnection(connectionId)) {
              cleanup();
            }
          } catch {
            cleanup();
          }
        }, 10_000);

        const snapshotStartSeq = fromSeq === null ? await getLastSequence() : 0;
        // Get collections owned by this CLIENT connection
        const collectionIds = await getConnectionCollectionIds(
          connection.userId,
          clientConnectionId,
        );
        const collectionNames = await getCollectionNamesByIds(collectionIds, connection.userId);

        // Load displayName for each connected collection.
        const collectionDisplayNames = new Map<number, string>();
        if (collectionIds.length > 0) {
          const colRows = await db
            .select({ id: collectionTable.id, displayName: collectionTable.displayName })
            .from(collectionTable)
            .where(
              and(
                eq(collectionTable.userId, connection.userId),
                inArray(collectionTable.id, collectionIds),
              ),
            );
          for (const r of colRows) {
            collectionDisplayNames.set(r.id, r.displayName);
          }
        }

        // Send merged schemas for each collection.
        // Compute from flows targeting these collections.
        if (collectionIds.length > 0) {
          // Get flows that target these collections, joined with source collection schema
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
            .where(
              and(
                eq(flowTable.userId, connection.userId),
                inArray(flowTable.targetId, collectionIds),
              ),
            );

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
            const name = collectionNames.get(colId);
            if (!name) continue;
            const displayName = collectionDisplayNames.get(colId) ?? name;
            const schema = mergedSchemas.get(colId) ?? {};
            server.sendSchema(controller, name, displayName, schema);
          }
        }

        if (fromSeq === null) {
          log.debug({ userId: connection.userId, clientConnectionId }, "Starting snapshot");
          server.sendBinaryEvent(controller, [EventType.SNAPSHOT_START]);

          await setSnapshotProgress(connection.userId, clientConnectionId, snapshotStartSeq);
          server.setSnapshotMode(connection.userId, clientConnectionId);

          const config = await runEffectWithServices(
            getSyncConfig(connection.userId, clientConnectionId),
          );

          const validationCollector = new ValidationErrorCollector();
          let snapshotItemCount = 0;
          for await (const item of fetchAndStreamItems(config, validationCollector)) {
            if (request.signal.aborted) break;
            const wireEvent: [typeof EventType.ITEM_CHANGED, ReturnType<typeof toWireItem>] = [
              EventType.ITEM_CHANGED,
              toWireItem(
                item,
                collectionNames.get(item.collection) ?? String(item.collection),
                item.includeRef,
              ),
            ];
            const seq = await publishSnapshot(connection.userId, clientConnectionId, wireEvent);
            snapshotItemCount++;
            server.sendIndexedItem(controller, seq, wireEvent, Boolean(item.includeRef));
          }

          server.sendBinaryEvent(controller, [EventType.SNAPSHOT_END]);
          await purgeConnectionSnapshot(connection.userId, clientConnectionId);
          await clearSnapshotProgress(connection.userId, clientConnectionId);
          server.clearSnapshotMode(connection.userId, clientConnectionId);
          log.debug(
            { userId: connection.userId, clientConnectionId, itemCount: snapshotItemCount },
            "Snapshot complete",
          );

          // Create incidents for validation errors
          if (validationCollector.size > 0) {
            for (const group of validationCollector.getGroups()) {
              try {
                await runEffectWithServices(
                  createIncident(connection.userId, {
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
              } catch (e) {
                log.error({ err: e }, "Failed to create validation incident");
              }
            }
          }
        }

        // Resume an interrupted snapshot from the dedicated snapshot stream.
        if (resumeFromSnapshot) {
          server.setSnapshotMode(connection.userId, clientConnectionId);
          server.sendBinaryEvent(controller, [EventType.SNAPSHOT_START]);

          for await (const { seq, event } of replaySnapshotFrom(
            connection.userId,
            clientConnectionId,
            fromSeq!,
          )) {
            if (request.signal.aborted) break;
            server.sendIndexedItem(controller, seq, event);
          }

          server.sendBinaryEvent(controller, [EventType.SNAPSHOT_END]);

          const progress = await getSnapshotProgress(connection.userId, clientConnectionId);
          const eventsStartSeq = progress?.eventsStartSeq ?? 0;
          await purgeConnectionSnapshot(connection.userId, clientConnectionId);
          await clearSnapshotProgress(connection.userId, clientConnectionId);
          server.clearSnapshotMode(connection.userId, clientConnectionId);

          fromSeq = eventsStartSeq;
        }

        const replayStartSeq = fromSeq ?? snapshotStartSeq + 1;
        if (hasNats()) {
          const collectionIds = await getConnectionCollectionIds(info.userId, info.connectionId);
          const refPolicyByCollection = await getConnectionRefPolicy(
            info.userId,
            info.connectionId,
          );

          if (collectionIds.length > 0 && replayStartSeq > 0 && !request.signal.aborted) {
            log.debug(
              {
                userId: info.userId,
                clientConnectionId: info.connectionId,
                fromSeq: replayStartSeq,
              },
              "Starting replay",
            );
            for await (const { seq, collectionId, event } of replayEvents({
              fromSeq: replayStartSeq,
              userId: info.userId,
              collectionIds,
            })) {
              if (request.signal.aborted) break;
              server.sendIndexedItem(
                controller,
                seq,
                event,
                refPolicyByCollection.get(collectionId) ?? true,
              );
            }
            log.debug(
              { userId: info.userId, clientConnectionId: info.connectionId },
              "Replay complete",
            );
          }
        }
      } catch (error) {
        log.error({ err: error }, "Sync stream error");
        cleanup();
      } finally {
        request.signal.removeEventListener("abort", onAbort);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
};

export const OPTIONS: RequestHandler = () => {
  return new Response(null, { status: 204 });
};
