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

  const seqParam = url.searchParams.get("seq");
  const seq = seqParam !== null ? Number.parseInt(seqParam, 10) : null;
  if (seq === null || !Number.isFinite(seq) || seq < 0) {
    return new Response("Invalid 'seq' parameter", { status: 400 });
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

  await getStreamServer().ackConsumerSequence(consumer.userId, consumer.id, seq);
  return new Response(null, { status: 204 });
};
