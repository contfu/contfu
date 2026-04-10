import { authenticateApiKey } from "$lib/server/auth";
import { runWithUser } from "$lib/server/run";
import { getCollection } from "@contfu/svc-backend/features/collections/getCollection";
import { listInflowSchemas } from "@contfu/svc-backend/features/collections/listInflowSchemas";
import { generateTypeScript } from "@contfu/svc-core";
import { parseIdParam } from "../../../encode";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "read");
  const collectionId = parseIdParam("collection", params.id);
  const collection = await runWithUser(userId, getCollection(collectionId));
  if (!collection) return new Response("Not found", { status: 404 });

  const inflowSchemas = await runWithUser(userId, listInflowSchemas(userId, collectionId));

  const ts = generateTypeScript([
    {
      name: collection.name,
      displayName: collection.displayName,
      schema: collection.schema,
      refTargets: collection.refTargets,
      inflowSchemas,
    },
  ]);

  return new Response(ts, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
