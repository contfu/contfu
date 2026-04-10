import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { parseBody, CreateFlowSchema } from "../schemas";
import { runWithUser } from "$lib/server/run";
import { listFlows } from "@contfu/svc-backend/features/flows/listFlows";
import { createFlow } from "@contfu/svc-backend/features/flows/createFlow";
import { triggerSnapshotForCollection } from "@contfu/svc-backend/features/consumers/triggerConsumerSnapshot";
import { getSyncWorkerManager } from "$lib/server/startup";
import { createLogger } from "@contfu/svc-backend/infra/logger/index";
import { Effect } from "effect";
import { pack } from "msgpackr";

import { encodeApiFlow } from "../encode";

const log = createLogger("flows-api");

type CreateResourceError = {
  _error: {
    status: number;
    body: {
      message: string;
      resource?: string;
      current?: number;
      max?: number;
    };
  };
};

function isCreateResourceError(result: unknown): result is CreateResourceError {
  return result != null && typeof result === "object" && "_error" in result;
}

export async function GET({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "read");
  const result = await runWithUser(userId, listFlows());
  return json(result.map(encodeApiFlow));
}

export async function POST({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "write");
  const body = parseBody(CreateFlowSchema, await request.json());
  const result = await runWithUser(
    userId,
    createFlow(userId, {
      sourceId: body.sourceId,
      targetId: body.targetId,
      filters: body.filters ? Buffer.from(pack(body.filters)) : undefined,
      schema: body.schema ? Buffer.from(pack(body.schema)) : undefined,
      includeRef: body.includeRef,
    }).pipe(
      Effect.catchTag("QuotaError", (e) =>
        Effect.succeed<CreateResourceError>({
          _error: {
            status: 403,
            body: {
              message: `${e.resource} quota exceeded`,
              resource: e.resource,
              current: e.current,
              max: e.max,
            },
          },
        }),
      ),
      Effect.catchTag("ValidationError", (e) =>
        Effect.succeed<CreateResourceError>({
          _error: {
            status: 400,
            body: { message: e.message },
          },
        }),
      ),
    ),
  );
  if (isCreateResourceError(result)) {
    return json(result._error.body, { status: result._error.status });
  }

  // Broadcast updated schema to connected clients and trigger a snapshot so existing
  // items from the source collection are delivered to the new influx target.
  getSyncWorkerManager()
    .broadcastSchema(userId, result.targetId)
    .catch((err) =>
      log.error(
        { err, userId, targetId: result.targetId },
        "broadcastSchema failed after flow creation",
      ),
    );
  triggerSnapshotForCollection(userId, result.targetId).catch((err) =>
    log.error(
      { err, userId, targetId: result.targetId },
      "triggerSnapshotForCollection failed after flow creation",
    ),
  );

  return json(encodeApiFlow(result), { status: 201 });
}
