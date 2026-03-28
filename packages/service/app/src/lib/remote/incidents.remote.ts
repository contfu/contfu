import { command, query } from "$app/server";
import { runWithUser } from "$lib/server/run";
import { getUserId } from "$lib/server/user";
import { listIncidents } from "@contfu/svc-backend/features/incidents/listIncidents";
import { getUnresolvedIncidentCount } from "@contfu/svc-backend/features/incidents/getUnresolvedIncidentCount";
import { resolveIncident as resolveIncidentFeature } from "@contfu/svc-backend/features/incidents/resolveIncident";
import { idSchema } from "@contfu/svc-backend/infra/ids";
import * as v from "valibot";

/**
 * List unresolved incidents for the current user.
 */
export const getIncidents = query(async () => {
  const userId = getUserId();
  return runWithUser(userId, listIncidents(userId, { resolved: false }));
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
