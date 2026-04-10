import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { runWithUser } from "$lib/server/run";
import { ConnectionType } from "@contfu/core";
import { getConnection } from "@contfu/svc-backend/features/connections/getConnection";
import { updateConnection } from "@contfu/svc-backend/features/connections/updateConnection";
import { hashApiKey } from "$lib/server/connection-auth";
import { randomBytes } from "node:crypto";
import { parseIdParam } from "../../../encode";

export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "write");
  const id = parseIdParam("connection", params.id);

  const connection = await runWithUser(userId, getConnection(id));
  if (!connection) return new Response("Not found", { status: 404 });
  if (connection.type !== ConnectionType.APP) {
    return json({ message: "Only app connections support key regeneration" }, { status: 400 });
  }

  const apiKeyStr = randomBytes(32).toString("base64url");
  await runWithUser(
    userId,
    updateConnection(id, {
      credentials: hashApiKey(apiKeyStr),
      skipCredentialsEncryption: true,
    }),
  );

  return json({ apiKey: apiKeyStr });
}
