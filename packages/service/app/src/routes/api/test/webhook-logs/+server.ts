import { db } from "@contfu/svc-backend/infra/db/db";
import { webhookLogTable, sourceTable } from "@contfu/svc-backend/infra/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  if (process.env.TEST_MODE !== "true") {
    return new Response("Not available", { status: 403 });
  }

  const sourceUid = url.searchParams.get("sourceUid");
  if (!sourceUid) {
    return Response.json({ error: "sourceUid required" }, { status: 400 });
  }

  // Look up source by uid
  const [source] = await db
    .select({ userId: sourceTable.userId, id: sourceTable.id })
    .from(sourceTable)
    .where(eq(sourceTable.uid, sourceUid))
    .limit(1);

  if (!source) {
    return Response.json([]);
  }

  const logs = await db
    .select({
      event: webhookLogTable.event,
      model: webhookLogTable.model,
      status: webhookLogTable.status,
      errorMessage: webhookLogTable.errorMessage,
      itemsBroadcast: webhookLogTable.itemsBroadcast,
    })
    .from(webhookLogTable)
    .where(and(eq(webhookLogTable.userId, source.userId), eq(webhookLogTable.sourceId, source.id)))
    .orderBy(desc(webhookLogTable.timestamp))
    .limit(50);

  return Response.json(logs);
};
