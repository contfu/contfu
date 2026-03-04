import { json } from "@sveltejs/kit";
import { Effect } from "effect";
import { authenticateApiKey } from "$lib/server/auth";
import { parseBody, UpdateCollectionSchema } from "../../schemas";
import { runWithUser } from "$lib/server/run";
import { getCollection } from "@contfu/svc-backend/features/collections/getCollection";
import { deleteCollection } from "@contfu/svc-backend/features/collections/deleteCollection";
import { updateCollection } from "@contfu/svc-backend/features/collections/updateCollection";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "read");
  const result = await runWithUser(userId, getCollection(userId, Number(params.id)));
  if (!result) return new Response("Not found", { status: 404 });
  return json(result);
}

export async function PATCH({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "write");
  const body = parseBody(UpdateCollectionSchema, await request.json());
  const updateResult = await runWithUser(
    userId,
    Effect.catchTag(updateCollection(userId, Number(params.id), body), "ValidationError", (e) =>
      Effect.succeed({ _validationError: e.message } as const),
    ),
  );
  if (
    updateResult != null &&
    typeof updateResult === "object" &&
    "_validationError" in updateResult
  ) {
    return json({ message: updateResult._validationError }, { status: 400 });
  }
  if (!updateResult) return new Response("Not found", { status: 404 });
  const result = await runWithUser(userId, getCollection(userId, Number(params.id)));
  return json(result);
}

export async function DELETE({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "write");
  const deleted = await runWithUser(userId, deleteCollection(userId, Number(params.id)));
  if (!deleted) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 204 });
}
