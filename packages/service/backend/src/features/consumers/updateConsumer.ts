import { db } from "../../infra/db/db";
import { consumerTable, type Consumer } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import type { BackendConsumer, UpdateConsumerInput } from "../../domain/types";

function mapToBackendConsumer(consumer: Consumer): BackendConsumer {
  return {
    id: consumer.id,
    userId: consumer.userId,
    name: consumer.name,
    includeRef: consumer.includeRef,
    hasKey: consumer.key !== null,
    createdAt: consumer.createdAt,
  };
}

/**
 * Update a consumer.
 * Returns undefined if not found or not owned by the user.
 */
export async function updateConsumer(
  userId: number,
  id: number,
  input: UpdateConsumerInput,
): Promise<BackendConsumer | undefined> {
  const [updated] = await db
    .update(consumerTable)
    .set(input)
    .where(and(eq(consumerTable.id, id), eq(consumerTable.userId, userId)))
    .returning();

  if (!updated) return undefined;

  return mapToBackendConsumer(updated);
}
