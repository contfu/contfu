import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { parseBody, UpdateInfluxSchema } from "../../schemas";
import { runWithUser } from "$lib/server/run";
import { getInflux } from "@contfu/svc-backend/features/influxes/getInflux";
import { deleteInflux } from "@contfu/svc-backend/features/influxes/deleteInflux";
import { updateInflux } from "@contfu/svc-backend/features/influxes/updateInflux";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "read");
  const result = await runWithUser(userId, getInflux(userId, Number(params.id)));
  if (!result) return new Response("Not found", { status: 404 });
  return json(result);
}

export async function PATCH({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "write");
  const body = parseBody(UpdateInfluxSchema, await request.json());
  const result = await runWithUser(
    userId,
    updateInflux(userId, {
      id: Number(params.id),
      ...body,
    }),
  );
  if (!result) return new Response("Not found", { status: 404 });
  return json(result);
}

export async function DELETE({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "write");
  const deleted = await runWithUser(userId, deleteInflux(userId, Number(params.id)));
  if (!deleted) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 204 });
}
