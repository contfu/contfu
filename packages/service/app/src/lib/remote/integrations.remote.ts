import { command, query } from "$app/server";
import { runWithUser } from "$lib/server/run";
import { getUserId } from "$lib/server/user";
import type { BackendIntegration } from "@contfu/svc-backend/domain/types";
import { listIntegrations as listIntegrationsFeature } from "@contfu/svc-backend/features/integrations/listIntegrations";
import { createIntegration as createIntegrationFeature } from "@contfu/svc-backend/features/integrations/createIntegration";
import { deleteIntegration as deleteIntegrationFeature } from "@contfu/svc-backend/features/integrations/deleteIntegration";
import { renameIntegration as renameIntegrationFeature } from "@contfu/svc-backend/features/integrations/renameIntegration";
import { encodeId, idSchema } from "@contfu/svc-backend/infra/ids";
import { error } from "@sveltejs/kit";
import * as v from "valibot";

function encodeIntegration(integration: BackendIntegration) {
  return {
    ...integration,
    id: encodeId("integration", integration.id),
    userId: encodeId("user", integration.userId),
  };
}

export const listIntegrations = query(async () => {
  const userId = getUserId();
  const integrations = await runWithUser(userId, listIntegrationsFeature(userId));
  return integrations.map(encodeIntegration);
});

export const createIntegration = command(
  v.object({
    providerId: v.pipe(v.string(), v.nonEmpty()),
    label: v.pipe(v.string(), v.nonEmpty("Label is required")),
    token: v.pipe(v.string(), v.nonEmpty("Token is required")),
  }),
  async (data) => {
    const userId = getUserId();
    const integration = await runWithUser(
      userId,
      createIntegrationFeature(userId, {
        providerId: data.providerId,
        label: data.label,
        credentials: Buffer.from(data.token, "utf-8"),
      }),
    );
    return encodeIntegration(integration);
  },
);

export const deleteIntegration = command(
  v.object({ id: idSchema("integration") }),
  async (data) => {
    const userId = getUserId();
    const deleted = await runWithUser(userId, deleteIntegrationFeature(userId, data.id));
    if (!deleted) error(404, "Integration not found");
    return { success: true };
  },
);

export const renameIntegration = command(
  v.object({
    id: idSchema("integration"),
    label: v.pipe(v.string(), v.nonEmpty("Label is required")),
  }),
  async (data) => {
    const userId = getUserId();
    const updated = await runWithUser(
      userId,
      renameIntegrationFeature(userId, data.id, data.label),
    );
    if (!updated) error(404, "Integration not found");
    return encodeIntegration(updated);
  },
);
