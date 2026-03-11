import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { parseBody, CreateCollectionSchema } from "../schemas";
import { runWithUser } from "$lib/server/run";
import { listCollections } from "@contfu/svc-backend/features/collections/listCollections";
import { createCollection } from "@contfu/svc-backend/features/collections/createCollection";

export async function GET({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "read");
  const result = await runWithUser(userId, listCollections());
  return json(result);
}

export async function POST({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "write");
  const body = parseBody(CreateCollectionSchema, await request.json());
  const result = await runWithUser(
    userId,
    createCollection(userId, {
      ...body,
      connectionId: body.connectionId ?? undefined,
    }),
  );
  return json(result, { status: 201 });
}
