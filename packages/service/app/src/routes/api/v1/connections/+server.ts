import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { parseBody, CreateConnectionSchema } from "../schemas";
import { runWithUser } from "$lib/server/run";
import { listConnections } from "@contfu/svc-backend/features/connections/listConnections";
import { createConnection } from "@contfu/svc-backend/features/connections/createConnection";

export async function GET({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "read");
  const result = await runWithUser(userId, listConnections(userId));
  return json(result);
}

export async function POST({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "write");
  const body = parseBody(CreateConnectionSchema, await request.json());
  const result = await runWithUser(userId, createConnection(userId, body));
  return json(result, { status: 201 });
}
