import { authenticateApiKey } from "$lib/server/auth";
import { runWithUser } from "$lib/server/run";
import { getConsumer } from "@contfu/svc-backend/features/consumers/getConsumer";
import { listConnectionsByConsumer } from "@contfu/svc-backend/features/connections/listConnectionsByConsumer";
import { getCollection } from "@contfu/svc-backend/features/collections/getCollection";
import { generateTypeScript, type TypeGenerationInput } from "@contfu/svc-core";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "read");
  const consumer = await runWithUser(userId, getConsumer(userId, Number(params.id)));
  if (!consumer) return new Response("Not found", { status: 404 });

  const connections = await runWithUser(userId, listConnectionsByConsumer(userId, consumer.id));

  const collections: TypeGenerationInput[] = [];
  for (const conn of connections) {
    const col = await runWithUser(userId, getCollection(userId, conn.collectionId));
    if (col) {
      collections.push({
        name: col.name,
        displayName: col.displayName,
        schema: col.schema,
        refTargets: col.refTargets,
      });
    }
  }

  const ts = generateTypeScript(collections);

  return new Response(ts, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
