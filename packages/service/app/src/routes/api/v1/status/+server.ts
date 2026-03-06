import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { runWithUser } from "$lib/server/run";
import { listCollections } from "@contfu/svc-backend/features/collections/listCollections";
import { listConsumerCollections } from "@contfu/svc-backend/features/consumers/listConsumerCollections";
import { listConsumers } from "@contfu/svc-backend/features/consumers/listConsumers";
import { listSources } from "@contfu/svc-backend/features/sources/listSources";

export async function GET({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "read");

  const [sources, collections, consumers, connections] = await Promise.all([
    runWithUser(userId, listSources(userId)),
    runWithUser(userId, listCollections(userId)),
    runWithUser(userId, listConsumers(userId)),
    runWithUser(userId, listConsumerCollections(userId)),
  ]);

  return json({
    sources: sources.length,
    collections: collections.length,
    consumers: consumers.length,
    connections: connections.length,
  });
}
