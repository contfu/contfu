import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { parseBody, CreateSourceSchema } from "../schemas";
import { runWithUser } from "$lib/server/run";
import { listSources } from "@contfu/svc-backend/features/sources/listSources";
import { createSource } from "@contfu/svc-backend/features/sources/createSource";

export async function GET({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "read");
  const result = await runWithUser(userId, listSources(userId));
  return json(result);
}

export async function POST({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "write");
  const body = parseBody(CreateSourceSchema, await request.json());
  const result = await runWithUser(
    userId,
    createSource(userId, {
      name: body.name,
      type: body.type,
      url: body.url ?? null,
      includeRef: body.includeRef,
    }),
  );
  return json(result, { status: 201 });
}
