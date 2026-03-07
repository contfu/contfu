import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { parseBody, CreateConsumerCollectionSchema } from "../schemas";
import { runWithUser } from "$lib/server/run";
import { listConsumerCollections } from "@contfu/svc-backend/features/consumers/listConsumerCollections";
import { connectCollectionToConsumer } from "@contfu/svc-backend/features/consumers/connectCollectionToConsumer";
import { triggerConsumerSnapshot } from "@contfu/svc-backend/features/consumers/triggerSnapshot";

export async function GET({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "read");
  const result = await runWithUser(userId, listConsumerCollections(userId));
  return json(result);
}

export async function POST({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "write");
  const body = parseBody(CreateConsumerCollectionSchema, await request.json());
  const result = await runWithUser(userId, connectCollectionToConsumer(userId, body));
  triggerConsumerSnapshot(result.userId, result.consumerId, result.collectionId).catch(() => {});
  return json(result, { status: 201 });
}
