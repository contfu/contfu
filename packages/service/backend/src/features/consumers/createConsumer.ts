import { db } from "../../infra/db/db";
import { consumerTable, type Consumer } from "../../infra/db/schema";
import { eq, sql } from "drizzle-orm";
import type { BackendConsumer, CreateConsumerInput } from "../../domain/types";

function mapToBackendConsumer(consumer: Consumer): BackendConsumer {
  return {
    id: consumer.id,
    userId: consumer.userId,
    name: consumer.name,
    hasKey: consumer.key !== null,
    createdAt: consumer.createdAt,
  };
}

/**
 * Create a new consumer for a user.
 * The ID is auto-generated as max(id) + 1 within the user's consumers.
 */
export async function createConsumer(
  userId: number,
  input: CreateConsumerInput,
): Promise<BackendConsumer> {
  const maxIdResult = await db
    .select({ maxId: sql<number>`coalesce(max(id), 0)` })
    .from(consumerTable)
    .where(eq(consumerTable.userId, userId))
    .limit(1);

  const nextId = (maxIdResult[0]?.maxId ?? 0) + 1;

  const [inserted] = await db
    .insert(consumerTable)
    .values({
      userId,
      id: nextId,
      name: input.name,
      key: input.key ?? null,
    })
    .returning();

  return mapToBackendConsumer(inserted);
}
