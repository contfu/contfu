import { command, query } from "$app/server";
import { runWithUser } from "$lib/server/run";
import { getUserId } from "$lib/server/user";
import { listIncidents } from "@contfu/svc-backend/features/incidents/listIncidents";
import { getUnresolvedIncidentCount } from "@contfu/svc-backend/features/incidents/getUnresolvedIncidentCount";
import { resolveIncident as resolveIncidentFeature } from "@contfu/svc-backend/features/incidents/resolveIncident";
import { encodeId, idSchema } from "@contfu/svc-backend/infra/ids";
import * as v from "valibot";

function encodeIncident(i: {
  id: number;
  flowId: number;
  sourceCollectionId: number;
  targetCollectionId: number;
  [key: string]: unknown;
}) {
  return {
    ...i,
    id: encodeId("incident", i.id),
    flowId: encodeId("flow", i.flowId),
    sourceCollectionId: encodeId("collection", i.sourceCollectionId),
    targetCollectionId: encodeId("collection", i.targetCollectionId),
  };
}

/**
 * List unresolved incidents for the current user.
 */
export const getIncidents = query(async () => {
  const userId = getUserId();
  const incidents = await runWithUser(userId, listIncidents(userId, { resolved: false }));
  return incidents.map(encodeIncident);
});

/**
 * Count unresolved incidents for badge display.
 */
export const getIncidentCount = query(async () => {
  const userId = getUserId();
  return await runWithUser(userId, getUnresolvedIncidentCount(userId));
});

/**
 * Resolve (delete) an incident.
 */
export const resolveIncident = command(
  v.object({
    id: idSchema("incident"),
  }),
  async (data) => {
    const userId = getUserId();
    await runWithUser(userId, resolveIncidentFeature(userId, data.id));
    return { success: true };
  },
);
