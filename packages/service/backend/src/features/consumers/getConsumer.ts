import { db } from "../../infra/db/db";
import { consumerTable, type Consumer } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import type { BackendConsumer } from "../../domain/types";

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
 * Get a single consumer by ID.
 */
export async function getConsumer(
  userId: number,
  id: number,
): Promise<BackendConsumer | undefined> {
  const [consumer] = await db
    .select()
    .from(consumerTable)
    .where(and(eq(consumerTable.userId, userId), eq(consumerTable.id, id)))
    .limit(1);

  if (!consumer) return undefined;

  return mapToBackendConsumer(consumer);
}
