import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { runWithUser } from "$lib/server/run";
import { getConnection } from "@contfu/svc-backend/features/connections/getConnection";
import { deleteConnection } from "@contfu/svc-backend/features/connections/deleteConnection";
import { updateConnection } from "@contfu/svc-backend/features/connections/updateConnection";
import { parseBody, UpdateConnectionSchema } from "../../schemas";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "read");
  const result = await runWithUser(userId, getConnection(Number(params.id)));
  if (!result) return new Response("Not found", { status: 404 });
  return json(result);
}

export async function PATCH({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "write");
  const body = parseBody(UpdateConnectionSchema, await request.json());
  const result = await runWithUser(userId, updateConnection(Number(params.id), body));
  if (!result) return new Response("Not found", { status: 404 });
  return json(result);
}

export async function DELETE({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "write");
  const deleted = await runWithUser(userId, deleteConnection(Number(params.id)));
  if (!deleted) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 204 });
}
