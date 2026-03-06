import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { runWithUser } from "$lib/server/run";
import { deleteIntegration } from "@contfu/svc-backend/features/integrations/deleteIntegration";
import { renameIntegration } from "@contfu/svc-backend/features/integrations/renameIntegration";
import * as v from "valibot";
import { parseBody } from "../../schemas";

const UpdateIntegrationSchema = v.object({
  label: v.optional(v.pipe(v.string(), v.nonEmpty())),
});

export async function PATCH({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "write");
  const body = parseBody(UpdateIntegrationSchema, await request.json());
  if (body.label) {
    const result = await runWithUser(
      userId,
      renameIntegration(userId, Number(params.id), body.label),
    );
    if (!result) return new Response("Not found", { status: 404 });
    return json(result);
  }
  return new Response("No updates provided", { status: 400 });
}

export async function DELETE({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "write");
  const deleted = await runWithUser(userId, deleteIntegration(userId, Number(params.id)));
  if (!deleted) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 204 });
}
