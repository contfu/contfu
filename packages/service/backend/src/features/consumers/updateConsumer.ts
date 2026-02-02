import { db } from "../../infra/db/db";
import { consumerTable, type Consumer } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import type { BackendConsumer, UpdateConsumerInput } from "../../domain/types";

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
 * Update a consumer.
 */
export async function updateConsumer(
  userId: number,
  id: number,
  input: UpdateConsumerInput,
): Promise<BackendConsumer | undefined> {
  const [updated] = await db
    .update(consumerTable)
    .set(input)
    .where(and(eq(consumerTable.userId, userId), eq(consumerTable.id, id)))
    .returning();

  if (!updated) return undefined;

  return mapToBackendConsumer(updated);
}
