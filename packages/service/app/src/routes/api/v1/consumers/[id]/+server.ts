import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { parseBody, UpdateConsumerSchema } from "../../schemas";
import { runWithUser } from "$lib/server/run";
import { getConsumer } from "@contfu/svc-backend/features/consumers/getConsumer";
import { deleteConsumer } from "@contfu/svc-backend/features/consumers/deleteConsumer";
import { updateConsumer } from "@contfu/svc-backend/features/consumers/updateConsumer";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "read");
  const result = await runWithUser(userId, getConsumer(userId, Number(params.id)));
  if (!result) return new Response("Not found", { status: 404 });
  return json(result);
}

export async function PATCH({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "write");
  const body = parseBody(UpdateConsumerSchema, await request.json());
  const result = await runWithUser(userId, updateConsumer(userId, Number(params.id), body));
  if (!result) return new Response("Not found", { status: 404 });
  return json(result);
}

export async function DELETE({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "write");
  const deleted = await runWithUser(userId, deleteConsumer(userId, Number(params.id)));
  if (!deleted) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 204 });
}
