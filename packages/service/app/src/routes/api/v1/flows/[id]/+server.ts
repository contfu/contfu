import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { parseBody, UpdateFlowSchema } from "../../schemas";
import { runWithUser } from "$lib/server/run";
import { getFlowWithDetails } from "@contfu/svc-backend/features/flows/getFlowWithDetails";
import { deleteFlow } from "@contfu/svc-backend/features/flows/deleteFlow";
import { updateFlow } from "@contfu/svc-backend/features/flows/updateFlow";
import { pack } from "msgpackr";
import { parseIdParam, encodeApiFlow } from "../../encode";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "read");
  const id = parseIdParam("flow", params.id);
  const result = await runWithUser(userId, getFlowWithDetails(id));
  if (!result) return new Response("Not found", { status: 404 });
  return json(encodeApiFlow(result));
}

export async function PATCH({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "write");
  const id = parseIdParam("flow", params.id);
  const body = parseBody(UpdateFlowSchema, await request.json());
  const updates: Record<string, unknown> = {};
  if (body.filters !== undefined)
    updates.filters = body.filters ? Buffer.from(pack(body.filters)) : null;
  if (body.mappings !== undefined)
    updates.mappings = body.mappings ? Buffer.from(pack(body.mappings)) : null;
  if (body.schema !== undefined)
    updates.schema = body.schema ? Buffer.from(pack(body.schema)) : null;
  if (body.includeRef !== undefined) updates.includeRef = body.includeRef;
  const result = await runWithUser(userId, updateFlow(id, updates as any));
  if (!result) return new Response("Not found", { status: 404 });
  return json(encodeApiFlow(result));
}

export async function DELETE({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "write");
  const id = parseIdParam("flow", params.id);
  const deleted = await runWithUser(userId, deleteFlow(id));
  if (!deleted) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 204 });
}
