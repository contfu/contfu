import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { parseBody, CreateFlowSchema } from "../schemas";
import { runWithUser } from "$lib/server/run";
import { listFlows } from "@contfu/svc-backend/features/flows/listFlows";
import { createFlow } from "@contfu/svc-backend/features/flows/createFlow";
import { triggerSnapshotForCollection } from "@contfu/svc-backend/features/consumers/triggerConsumerSnapshot";
import { getSyncWorkerManager } from "$lib/server/startup";
import { Effect } from "effect";
import { pack } from "msgpackr";

export async function GET({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "read");
  const result = await runWithUser(userId, listFlows());
  return json(result);
}

export async function POST({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "write");
  const body = parseBody(CreateFlowSchema, await request.json());
  const result = await runWithUser(
    userId,
    Effect.catchTag(
      createFlow(userId, {
        sourceId: body.sourceId,
        targetId: body.targetId,
        filters: body.filters ? Buffer.from(pack(body.filters)) : undefined,
        schema: body.schema ? Buffer.from(pack(body.schema)) : undefined,
        includeRef: body.includeRef,
      }),
      "ValidationError",
      (e) => Effect.fail({ _validationError: e.message }),
    ),
  );
  if (result != null && typeof result === "object" && "_validationError" in result) {
    return json({ message: result._validationError }, { status: 400 });
  }

  // Broadcast updated schema to connected clients and trigger a snapshot so existing
  // items from the source collection are delivered to the new influx target.
  getSyncWorkerManager()
    .broadcastSchema(userId, result.targetId)
    .catch(() => {});
  triggerSnapshotForCollection(userId, result.targetId).catch(() => {});

  return json(result, { status: 201 });
}
