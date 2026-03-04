import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { parseBody, CreateInfluxSchema } from "../schemas";
import { runWithUser } from "$lib/server/run";
import { listAllInfluxes } from "@contfu/svc-backend/features/influxes/listAllInfluxes";
import { createInflux } from "@contfu/svc-backend/features/influxes/createInflux";

export async function GET({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "read");
  const result = await runWithUser(userId, listAllInfluxes(userId));
  return json(result);
}

export async function POST({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "write");
  const body = parseBody(CreateInfluxSchema, await request.json());
  const result = await runWithUser(userId, createInflux(userId, body));
  return json(result, { status: 201 });
}
