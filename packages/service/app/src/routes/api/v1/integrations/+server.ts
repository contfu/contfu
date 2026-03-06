import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { runWithUser } from "$lib/server/run";
import { listIntegrations } from "@contfu/svc-backend/features/integrations/listIntegrations";
import { createIntegration } from "@contfu/svc-backend/features/integrations/createIntegration";
import * as v from "valibot";
import { parseBody } from "../schemas";

const CreateIntegrationSchema = v.object({
  providerId: v.pipe(v.string(), v.nonEmpty()),
  label: v.pipe(v.string(), v.nonEmpty()),
  token: v.optional(v.string()),
});

export async function GET({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "read");
  const result = await runWithUser(userId, listIntegrations(userId));
  return json(result);
}

export async function POST({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "write");
  const body = parseBody(CreateIntegrationSchema, await request.json());
  const result = await runWithUser(
    userId,
    createIntegration(userId, {
      providerId: body.providerId,
      label: body.label,
      credentials: body.token ? Buffer.from(body.token, "utf-8") : undefined,
    }),
  );
  return json(result, { status: 201 });
}
