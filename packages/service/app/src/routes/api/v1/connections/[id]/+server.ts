import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { parseBody, UpdateConnectionSchema } from "../../schemas";
import { runWithUser } from "$lib/server/run";
import { getConnection } from "@contfu/svc-backend/features/connections/getConnection";
import { deleteConnection } from "@contfu/svc-backend/features/connections/deleteConnection";
import { updateConnection } from "@contfu/svc-backend/features/connections/updateConnection";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "read");
  const [consumerId, collectionId] = params.id.split("-").map(Number);
  if (!consumerId || !collectionId)
    return new Response("Invalid id format. Use consumerId-collectionId", { status: 400 });
  const result = await runWithUser(userId, getConnection(userId, consumerId, collectionId));
  if (!result) return new Response("Not found", { status: 404 });
  return json(result);
}

export async function PATCH({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "write");
  const [consumerId, collectionId] = params.id.split("-").map(Number);
  if (!consumerId || !collectionId)
    return new Response("Invalid id format. Use consumerId-collectionId", { status: 400 });
  const body = parseBody(UpdateConnectionSchema, await request.json());
  const result = await runWithUser(
    userId,
    updateConnection(userId, consumerId, collectionId, body),
  );
  if (!result) return new Response("Not found", { status: 404 });
  return json(result);
}

export async function DELETE({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "write");
  const [consumerId, collectionId] = params.id.split("-").map(Number);
  if (!consumerId || !collectionId)
    return new Response("Invalid id format. Use consumerId-collectionId", { status: 400 });
  const deleted = await runWithUser(userId, deleteConnection(userId, consumerId, collectionId));
  if (!deleted) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 204 });
}
