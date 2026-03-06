import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { runWithUser } from "$lib/server/run";
import { getConsumer } from "@contfu/svc-backend/features/consumers/getConsumer";
import { listConsumerCollectionsByConsumer } from "@contfu/svc-backend/features/consumers/listConsumerCollectionsByConsumer";
import { getCollection } from "@contfu/svc-backend/features/collections/getCollection";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "read");
  const consumer = await runWithUser(userId, getConsumer(userId, Number(params.id)));
  if (!consumer) return new Response("Not found", { status: 404 });

  const connections = await runWithUser(
    userId,
    listConsumerCollectionsByConsumer(userId, consumer.id),
  );

  const collections = [];
  for (const conn of connections) {
    const col = await runWithUser(userId, getCollection(userId, conn.collectionId));
    if (col) {
      collections.push({
        id: col.id,
        name: col.name,
        displayName: col.displayName,
        schema: col.schema,
        refTargets: col.refTargets,
      });
    }
  }

  return json(collections);
}
