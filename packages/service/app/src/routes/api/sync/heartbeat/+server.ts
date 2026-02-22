import { extractConsumerKey } from "$lib/server/consumer-auth";
import { getStreamServer } from "$lib/server/startup";
import { consumerTable, db } from "@contfu/svc-backend/infra/db/db";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, url }) => {
  const auth = extractConsumerKey(url, request);
  if ("error" in auth) return auth.error;
  const { key } = auth;

  if (key.length !== 32) {
    return new Response("Invalid key format", { status: 401 });
  }

  const consumers = await db
    .select({ userId: consumerTable.userId, id: consumerTable.id })
    .from(consumerTable)
    .where(eq(consumerTable.key, key))
    .limit(1);
  const consumer = consumers[0];
  if (!consumer) {
    return new Response("Invalid or unknown consumer key", { status: 401 });
  }

  getStreamServer().markConsumerHeartbeat(consumer.userId, consumer.id);
  return new Response(null, { status: 204 });
};

