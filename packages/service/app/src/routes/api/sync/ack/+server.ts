import { extractConnectionKey } from "$lib/server/connection-auth";
import { getStreamServer } from "$lib/server/startup";
import { ConnectionType } from "@contfu/core";
import { connectionTable, db } from "@contfu/svc-backend/infra/db/db";
import { and, eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, url }) => {
  const auth = extractConnectionKey(url, request);
  if ("error" in auth) return auth.error;
  const { key } = auth;

  if (key.length !== 32) {
    return new Response("Invalid key format", { status: 401 });
  }

  const seqParam = url.searchParams.get("seq");
  const seq = seqParam !== null ? Number.parseInt(seqParam, 10) : null;
  if (seq === null || !Number.isFinite(seq) || seq < 0) {
    return new Response("Invalid 'seq' parameter", { status: 400 });
  }

  // Authenticate by finding the CLIENT connection with this key
  const connections = await db
    .select({ userId: connectionTable.userId, id: connectionTable.id })
    .from(connectionTable)
    .where(
      and(eq(connectionTable.credentials, key), eq(connectionTable.type, ConnectionType.CLIENT)),
    )
    .limit(1);
  const connection = connections[0];
  if (!connection) {
    return new Response("Invalid or unknown consumer key", { status: 401 });
  }

  await getStreamServer().ackConnectionSequence(connection.userId, connection.id, seq);
  return new Response(null, { status: 204 });
};
