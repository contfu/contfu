import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { parseBody, UpdateSourceSchema } from "../../schemas";
import { runWithUser } from "$lib/server/run";
import { getSource } from "@contfu/svc-backend/features/sources/getSource";
import { deleteSource } from "@contfu/svc-backend/features/sources/deleteSource";
import { updateSource } from "@contfu/svc-backend/features/sources/updateSource";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "read");
  const result = await runWithUser(userId, getSource(userId, Number(params.id)));
  if (!result) return new Response("Not found", { status: 404 });
  return json(result);
}

export async function PATCH({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "write");
  const body = parseBody(UpdateSourceSchema, await request.json());
  const result = await runWithUser(userId, updateSource(userId, Number(params.id), body));
  if (!result) return new Response("Not found", { status: 404 });
  return json(result);
}

export async function DELETE({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "write");
  const deleted = await runWithUser(userId, deleteSource(userId, Number(params.id)));
  if (!deleted) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 204 });
}
