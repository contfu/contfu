import { db } from "@contfu/svc-backend/infra/db/db";
import { sourceTable } from "@contfu/svc-backend/infra/db/schema";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  if (process.env.TEST_MODE !== "true") {
    return new Response("Not available", { status: 403 });
  }

  const id = url.searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id required" }, { status: 400 });
  }

  const [source] = await db
    .select({ id: sourceTable.id, uid: sourceTable.uid })
    .from(sourceTable)
    .where(eq(sourceTable.id, Number(id)))
    .limit(1);

  if (!source) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  return Response.json(source);
};
