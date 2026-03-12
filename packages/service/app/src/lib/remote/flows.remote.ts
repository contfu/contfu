import { command, form, query } from "$app/server";
import { runWithUser } from "$lib/server/run";
import { getSyncWorkerManager, getStreamServer } from "$lib/server/startup";
import { getUserId } from "$lib/server/user";
import { EventType, type WireEvent } from "@contfu/core";
import type { BackendFlowWithDetails } from "@contfu/svc-backend/domain/types";
import { getCollection } from "@contfu/svc-backend/features/collections/getCollection";
import { getCollectionSchema } from "@contfu/svc-backend/features/collections/getCollectionSchema";
import { updateCollection as updateCollectionFeature } from "@contfu/svc-backend/features/collections/updateCollection";
import { createFlow as createFlowFeature } from "@contfu/svc-backend/features/flows/createFlow";
import { deleteFlow as deleteFlowFeature } from "@contfu/svc-backend/features/flows/deleteFlow";
import { listFlows as listFlowsFeature } from "@contfu/svc-backend/features/flows/listFlows";
import { listFlowsByCollection as listFlowsByCollectionFeature } from "@contfu/svc-backend/features/flows/listFlowsByCollection";
import { updateFlow as updateFlowFeature } from "@contfu/svc-backend/features/flows/updateFlow";
import { encodeId, idSchema } from "@contfu/svc-backend/infra/ids";
import { triggerSnapshotForCollection } from "@contfu/svc-backend/features/consumers/triggerConsumerSnapshot";
import { autoWireMappings } from "@contfu/svc-core";
import type { Filter, MappingRule } from "@contfu/svc-core";
import { error, invalid } from "@sveltejs/kit";
import { pack } from "msgpackr";
import * as v from "valibot";

// =============================================================================
// Helpers
// =============================================================================

function encodeFlow(flow: BackendFlowWithDetails) {
  return {
    ...flow,
    id: encodeId("flow", flow.id),
    sourceId: encodeId("collection", flow.sourceId),
    targetId: encodeId("collection", flow.targetId),
  };
}

// =============================================================================
// Queries
// =============================================================================

/**
 * Get all flows for the current user.
 */
export const getFlows = query(async () => {
  const userId = getUserId();
  const flows = await runWithUser(userId, listFlowsFeature());
  return flows.map(encodeFlow);
});

/**
 * Get flows for a specific collection (as source or target).
 */
export const getFlowsByCollection = query(
  v.object({ collectionId: idSchema("collection") }),
  async ({ collectionId }) => {
    const userId = getUserId();
    const flows = await runWithUser(userId, listFlowsByCollectionFeature(collectionId));
    return flows.map(encodeFlow);
  },
);

// =============================================================================
// Commands
// =============================================================================

/**
 * Add a new flow between two collections.
 * Auto-wires mappings if both source and target have schemas.
 */
export const addFlow = command(
  v.object({
    sourceId: idSchema("collection"),
    targetId: idSchema("collection"),
    filters: v.optional(v.string()), // JSON string of Filter[]
    mappings: v.optional(v.string()), // JSON string of MappingRule[]
    includeRef: v.optional(
      v.pipe(
        v.union([v.string(), v.boolean()]),
        v.transform((val) => (typeof val === "boolean" ? val : val === "true")),
      ),
    ),
  }),
  async (data): Promise<{ success: true; flowId: string } | { success: false; error: string }> => {
    const userId = getUserId();

    // Parse filters if provided
    let filters: Filter[] | undefined;
    if (data.filters) {
      try {
        filters = JSON.parse(data.filters) as Filter[];
      } catch {
        invalid("Invalid filters JSON");
      }
    }

    // Parse mappings if provided, or auto-wire from schemas
    let mappings: MappingRule[] | undefined;
    if (data.mappings) {
      try {
        mappings = JSON.parse(data.mappings) as MappingRule[];
      } catch {
        invalid("Invalid mappings JSON");
      }
    } else {
      // Try to auto-wire mappings from source and target schemas
      const [sourceSchema, targetSchema] = await Promise.all([
        runWithUser(userId, getCollectionSchema(data.sourceId)),
        runWithUser(userId, getCollectionSchema(data.targetId)),
      ]);

      if (sourceSchema && targetSchema) {
        mappings = autoWireMappings(sourceSchema, targetSchema);
      }
    }

    // Build the source schema for the flow
    const sourceSchema = await runWithUser(userId, getCollectionSchema(data.sourceId));

    const flow = await runWithUser(
      userId,
      createFlowFeature(userId, {
        sourceId: data.sourceId,
        targetId: data.targetId,
        filters: filters ? pack(filters) : null,
        mappings: mappings ? pack(mappings) : null,
        schema: sourceSchema ? pack(sourceSchema) : null,
        includeRef: data.includeRef ?? true,
      }),
    );

    // Auto-initialize target schema from source if target has no schema yet
    const targetSchema = await runWithUser(userId, getCollectionSchema(data.targetId));
    if (sourceSchema && (!targetSchema || Object.keys(targetSchema).length === 0)) {
      await runWithUser(userId, updateCollectionFeature(data.targetId, { schema: sourceSchema }));
    }

    // Resync source collections, broadcast schema, and trigger a full snapshot
    // so existing source items are delivered to the new target consumer.
    await getSyncWorkerManager().resyncCollections([data.sourceId]);
    await getSyncWorkerManager().broadcastSchema(userId, data.targetId);
    triggerSnapshotForCollection(userId, data.targetId).catch(() => {});

    // Send COLLECTION_SCHEMA to the target collection's connections
    const targetCollection = await runWithUser(userId, getCollection(data.targetId));
    if (targetCollection) {
      const schemaEvent: WireEvent = [
        EventType.COLLECTION_SCHEMA,
        targetCollection.name,
        targetCollection.displayName,
        targetCollection.schema,
      ];
      getStreamServer().broadcastToCollection(userId, data.targetId, schemaEvent);
    }

    return {
      success: true as const,
      flowId: encodeId("flow", flow.id),
    };
  },
);

/**
 * Remove a flow.
 */
export const removeFlow = command(v.object({ id: idSchema("flow") }), async (data) => {
  const userId = getUserId();

  // Get flow details before deletion to broadcast removal
  const { getFlowWithDetails } =
    await import("@contfu/svc-backend/features/flows/getFlowWithDetails");
  const flow = await runWithUser(userId, getFlowWithDetails(data.id));

  const deleted = await runWithUser(userId, deleteFlowFeature(data.id));
  if (!deleted) error(404, "Flow not found");

  // Broadcast COLLECTION_REMOVED to the target
  if (flow) {
    const sourceCollection = await runWithUser(userId, getCollection(flow.sourceId));
    if (sourceCollection) {
      const removedEvent: WireEvent = [EventType.COLLECTION_REMOVED, sourceCollection.name];
      getStreamServer().broadcastToCollection(userId, flow.targetId, removedEvent);
    }
  }

  return { success: true };
});

/**
 * Update a flow's filters/mappings via form action.
 */
export const updateFlowForm = form(
  v.object({
    id: idSchema("flow"),
    filters: v.optional(v.string()), // JSON string of Filter[]
    mappings: v.optional(v.string()), // JSON string of MappingRule[]
    includeRef: v.optional(
      v.pipe(
        v.union([v.string(), v.boolean()]),
        v.transform((val) => (typeof val === "boolean" ? val : val === "true")),
      ),
    ),
  }),
  async (data, issue) => {
    const userId = getUserId();

    let filters: Buffer | undefined;
    if (data.filters) {
      try {
        const parsed = JSON.parse(data.filters) as Filter[];
        filters = pack(parsed);
      } catch {
        throw issue.filters("Invalid filters JSON");
      }
    }

    let mappings: Buffer | undefined;
    if (data.mappings) {
      try {
        const parsed = JSON.parse(data.mappings) as MappingRule[];
        mappings = pack(parsed);
      } catch {
        throw issue.mappings("Invalid mappings JSON");
      }
    }

    const result = await runWithUser(
      userId,
      updateFlowFeature(data.id, {
        filters,
        mappings,
        includeRef: data.includeRef,
      }),
    );

    if (!result) {
      throw issue.id("Flow not found");
    }

    return { success: true };
  },
);

/**
 * Programmatic flow filters update (command, not form) for use in saveMappings().
 */
export const updateFlowFilters = command(
  v.object({
    id: idSchema("flow"),
    filters: v.string(), // JSON string of Filter[]
  }),
  async (data) => {
    const userId = getUserId();
    const filters = JSON.parse(data.filters) as Filter[];

    await runWithUser(
      userId,
      updateFlowFeature(data.id, {
        filters: pack(filters),
      }),
    );

    return { success: true };
  },
);

/**
 * Programmatic flow mappings update (command, not form) for use in saveMappings().
 */
export const updateFlowMappings = command(
  v.object({
    id: idSchema("flow"),
    mappings: v.string(), // JSON string of MappingRule[]
  }),
  async (data) => {
    const userId = getUserId();

    const mappings = JSON.parse(data.mappings) as MappingRule[];

    const { getFlowWithDetails } =
      await import("@contfu/svc-backend/features/flows/getFlowWithDetails");
    const flow = await runWithUser(userId, getFlowWithDetails(data.id));
    if (!flow) error(404, "Flow not found");

    await runWithUser(
      userId,
      updateFlowFeature(data.id, {
        mappings: pack(mappings),
      }),
    );

    // Resync source collections, broadcast schema, and trigger a snapshot
    // so items are re-delivered with updated mappings applied.
    const manager = getSyncWorkerManager();
    await manager.resyncCollections([flow.sourceId]);
    await manager.broadcastSchema(userId, flow.targetId);
    triggerSnapshotForCollection(userId, flow.targetId).catch(() => {});

    return { success: true };
  },
);
