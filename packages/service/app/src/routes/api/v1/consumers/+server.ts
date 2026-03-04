import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { parseBody, CreateConsumerSchema } from "../schemas";
import { runWithUser } from "$lib/server/run";
import { listConsumers } from "@contfu/svc-backend/features/consumers/listConsumers";
import { createConsumer } from "@contfu/svc-backend/features/consumers/createConsumer";

export async function GET({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "read");
  const result = await runWithUser(userId, listConsumers(userId));
  return json(result);
}

export async function POST({ request }: { request: Request }) {
  const { userId } = await authenticateApiKey(request, "write");
  const body = parseBody(CreateConsumerSchema, await request.json());
  const result = await runWithUser(userId, createConsumer(userId, body));
  return json(result, { status: 201 });
}
