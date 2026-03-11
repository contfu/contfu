import { authenticateApiKey } from "$lib/server/auth";
import { runWithUser } from "$lib/server/run";
import { getCollection } from "@contfu/svc-backend/features/collections/getCollection";
import { generateTypeScript } from "@contfu/svc-core";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "read");
  const collection = await runWithUser(userId, getCollection(Number(params.id)));
  if (!collection) return new Response("Not found", { status: 404 });

  const ts = generateTypeScript([
    {
      name: collection.name,
      displayName: collection.displayName,
      schema: collection.schema,
      refTargets: collection.refTargets,
    },
  ]);

  return new Response(ts, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
