import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { runWithUser } from "$lib/server/run";
import { ConnectionType } from "@contfu/core";
import { listConnections } from "@contfu/svc-backend/features/connections/listConnections";
import { createConnection } from "@contfu/svc-backend/features/connections/createConnection";
import { parseBody, CreateConnectionSchema } from "../schemas";

export async function GET({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "read");
  const result = await runWithUser(userId, listConnections());
  return json(result);
}

export async function POST({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "write");
  const body = parseBody(CreateConnectionSchema, await request.json());
  const result = await runWithUser(
    userId,
    createConnection(userId, {
      type: body.type as ConnectionType,
      name: body.name,
      url: body.url,
      accountId: body.accountId,
      credentials: undefined,
      includeRef: body.includeRef,
    }),
  );
  return json(result, { status: 201 });
}
