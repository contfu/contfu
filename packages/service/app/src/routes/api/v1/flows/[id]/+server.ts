import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { parseBody, UpdateFlowSchema } from "../../schemas";
import { runWithUser } from "$lib/server/run";
import { getFlowWithDetails } from "@contfu/svc-backend/features/flows/getFlowWithDetails";
import { deleteFlow } from "@contfu/svc-backend/features/flows/deleteFlow";
import { updateFlow } from "@contfu/svc-backend/features/flows/updateFlow";
import { pack } from "msgpackr";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "read");
  const result = await runWithUser(userId, getFlowWithDetails(Number(params.id)));
  if (!result) return new Response("Not found", { status: 404 });
  return json(result);
}

export async function PATCH({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "write");
  const body = parseBody(UpdateFlowSchema, await request.json());
  const updates: Record<string, unknown> = {};
  if (body.filters !== undefined)
    updates.filters = body.filters ? Buffer.from(pack(body.filters)) : null;
  if (body.mappings !== undefined)
    updates.mappings = body.mappings ? Buffer.from(pack(body.mappings)) : null;
  if (body.schema !== undefined)
    updates.schema = body.schema ? Buffer.from(pack(body.schema)) : null;
  if (body.includeRef !== undefined) updates.includeRef = body.includeRef;
  const result = await runWithUser(userId, updateFlow(Number(params.id), updates as any));
  if (!result) return new Response("Not found", { status: 404 });
  return json(result);
}

export async function DELETE({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "write");
  const deleted = await runWithUser(userId, deleteFlow(Number(params.id)));
  if (!deleted) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 204 });
}
