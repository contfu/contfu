import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { runWithUser } from "$lib/server/run";
import { listCollections } from "@contfu/svc-backend/features/collections/listCollections";
import { listConnections } from "@contfu/svc-backend/features/connections/listConnections";
import { listFlows } from "@contfu/svc-backend/features/flows/listFlows";

export async function GET({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "read");

  const [connections, collections, flows] = await Promise.all([
    runWithUser(userId, listConnections()),
    runWithUser(userId, listCollections()),
    runWithUser(userId, listFlows()),
  ]);

  return json({
    connections: connections.length,
    collections: collections.length,
    flows: flows.length,
  });
}
