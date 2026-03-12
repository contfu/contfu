import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { runWithUser } from "$lib/server/run";
import { listCollectionsByConnection } from "@contfu/svc-backend/features/collections/listCollectionsByConnection";
import { getCollection } from "@contfu/svc-backend/features/collections/getCollection";
import { computeCollectionSchema } from "@contfu/svc-backend/features/collections/computeCollectionSchema";
import { listFlowsByCollection } from "@contfu/svc-backend/features/flows/listFlowsByCollection";
import type { TypeGenerationInput } from "@contfu/svc-core";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "read");

  const collections = await runWithUser(userId, listCollectionsByConnection(Number(params.id)));

  const result: TypeGenerationInput[] = [];
  const seen = new Set<number>();

  for (const col of collections) {
    seen.add(col.id);
    result.push({
      name: col.name,
      displayName: col.displayName,
      schema: col.schema,
      refTargets: col.refTargets,
    });

    const flows = await runWithUser(userId, listFlowsByCollection(col.id));
    for (const flow of flows) {
      if (!seen.has(flow.targetId)) {
        seen.add(flow.targetId);
        const target = await runWithUser(userId, getCollection(flow.targetId));
        if (target) {
          const schema = await runWithUser(userId, computeCollectionSchema(userId, flow.targetId));
          result.push({
            name: target.name,
            displayName: target.displayName,
            schema: Object.keys(schema).length > 0 ? schema : target.schema,
            refTargets: target.refTargets,
          });
        }
      }
    }
  }

  return json(result);
}
