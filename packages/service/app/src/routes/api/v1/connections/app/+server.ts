import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { runWithUser } from "$lib/server/run";
import { ConnectionType } from "@contfu/core";
import { createConnection } from "@contfu/svc-backend/features/connections/createConnection";
import { hashApiKey } from "$lib/server/connection-auth";
import { randomBytes } from "node:crypto";
import { Effect } from "effect";
import * as v from "valibot";

const CreateClientSchema = v.object({
  name: v.pipe(v.string(), v.nonEmpty("Name is required")),
});

export async function POST({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "write");
  const body = v.parse(CreateClientSchema, await request.json());

  const apiKeyStr = randomBytes(32).toString("base64url");

  const result = await runWithUser(
    userId,
    Effect.catchTag(
      createConnection(userId, {
        type: ConnectionType.APP,
        name: body.name,
        credentials: hashApiKey(apiKeyStr),
      }),
      "QuotaError",
      (e) =>
        Effect.succeed({
          _quotaError: { resource: e.resource, current: e.current, max: e.max },
        }),
    ),
  );

  if (result != null && typeof result === "object" && "_quotaError" in result) {
    return json(
      { message: `${result._quotaError.resource} quota exceeded`, ...result._quotaError },
      { status: 403 },
    );
  }

  return json({ ...result, apiKey: apiKeyStr }, { status: 201 });
}
