import { db } from "$lib/server/db/db";
import {
  collectionTable,
  connectionTable,
  consumerTable,
  type Connection,
} from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";

export type NewConnection = {
  consumerId: number;
  collectionId: number;
  lastItemChanged?: number | null;
  lastConsistencyCheck?: number | null;
};

export type ConnectionUpdate = {
  lastItemChanged?: number | null;
  lastConsistencyCheck?: number | null;
};

export type ConnectionWithDetails = Connection & {
  consumerName: string;
  collectionName: string;
};

/**
 * Insert a new connection for a user.
 */
export async function insertConnection(
  userId: number,
  connection: NewConnection,
): Promise<Connection> {
  const [inserted] = await db
    .insert(connectionTable)
    .values({
      userId,
      consumerId: connection.consumerId,
      collectionId: connection.collectionId,
      lastItemChanged: connection.lastItemChanged ?? null,
      lastConsistencyCheck: connection.lastConsistencyCheck ?? null,
    })
    .returning();

  return inserted;
}

/**
 * Get all connections for a user with consumer and collection names.
 */
export async function selectConnections(userId: number): Promise<ConnectionWithDetails[]> {
  const connections = await db
    .select({
      userId: connectionTable.userId,
      consumerId: connectionTable.consumerId,
      collectionId: connectionTable.collectionId,
      lastItemChanged: connectionTable.lastItemChanged,
      lastConsistencyCheck: connectionTable.lastConsistencyCheck,
      consumerName: consumerTable.name,
      collectionName: collectionTable.name,
    })
    .from(connectionTable)
    .innerJoin(
      consumerTable,
      and(
        eq(connectionTable.userId, consumerTable.userId),
        eq(connectionTable.consumerId, consumerTable.id),
      ),
    )
    .innerJoin(
      collectionTable,
      and(
        eq(connectionTable.userId, collectionTable.userId),
        eq(connectionTable.collectionId, collectionTable.id),
      ),
    )
    .where(eq(connectionTable.userId, userId));

  return connections;
}

/**
 * Get all connections for a specific consumer with collection names.
 */
export async function selectConnectionsByConsumer(
  userId: number,
  consumerId: number,
): Promise<ConnectionWithDetails[]> {
  const connections = await db
    .select({
      userId: connectionTable.userId,
      consumerId: connectionTable.consumerId,
      collectionId: connectionTable.collectionId,
      lastItemChanged: connectionTable.lastItemChanged,
      lastConsistencyCheck: connectionTable.lastConsistencyCheck,
      consumerName: consumerTable.name,
      collectionName: collectionTable.name,
    })
    .from(connectionTable)
    .innerJoin(
      consumerTable,
      and(
        eq(connectionTable.userId, consumerTable.userId),
        eq(connectionTable.consumerId, consumerTable.id),
      ),
    )
    .innerJoin(
      collectionTable,
      and(
        eq(connectionTable.userId, collectionTable.userId),
        eq(connectionTable.collectionId, collectionTable.id),
      ),
    )
    .where(and(eq(connectionTable.userId, userId), eq(connectionTable.consumerId, consumerId)));

  return connections;
}

/**
 * Get all connections for a specific collection with consumer names.
 */
export async function selectConnectionsByCollection(
  userId: number,
  collectionId: number,
): Promise<ConnectionWithDetails[]> {
  const connections = await db
    .select({
      userId: connectionTable.userId,
      consumerId: connectionTable.consumerId,
      collectionId: connectionTable.collectionId,
      lastItemChanged: connectionTable.lastItemChanged,
      lastConsistencyCheck: connectionTable.lastConsistencyCheck,
      consumerName: consumerTable.name,
      collectionName: collectionTable.name,
    })
    .from(connectionTable)
    .innerJoin(
      consumerTable,
      and(
        eq(connectionTable.userId, consumerTable.userId),
        eq(connectionTable.consumerId, consumerTable.id),
      ),
    )
    .innerJoin(
      collectionTable,
      and(
        eq(connectionTable.userId, collectionTable.userId),
        eq(connectionTable.collectionId, collectionTable.id),
      ),
    )
    .where(and(eq(connectionTable.userId, userId), eq(connectionTable.collectionId, collectionId)));

  return connections;
}

/**
 * Get a single connection by consumer and collection ID.
 */
export async function selectConnection(
  userId: number,
  consumerId: number,
  collectionId: number,
): Promise<Connection | undefined> {
  const [connection] = await db
    .select()
    .from(connectionTable)
    .where(
      and(
        eq(connectionTable.userId, userId),
        eq(connectionTable.consumerId, consumerId),
        eq(connectionTable.collectionId, collectionId),
      ),
    )
    .limit(1);

  return connection;
}

/**
 * Get a single connection with consumer and collection details.
 */
export async function selectConnectionWithDetails(
  userId: number,
  consumerId: number,
  collectionId: number,
): Promise<ConnectionWithDetails | undefined> {
  const [connection] = await db
    .select({
      userId: connectionTable.userId,
      consumerId: connectionTable.consumerId,
      collectionId: connectionTable.collectionId,
      lastItemChanged: connectionTable.lastItemChanged,
      lastConsistencyCheck: connectionTable.lastConsistencyCheck,
      consumerName: consumerTable.name,
      collectionName: collectionTable.name,
    })
    .from(connectionTable)
    .innerJoin(
      consumerTable,
      and(
        eq(connectionTable.userId, consumerTable.userId),
        eq(connectionTable.consumerId, consumerTable.id),
      ),
    )
    .innerJoin(
      collectionTable,
      and(
        eq(connectionTable.userId, collectionTable.userId),
        eq(connectionTable.collectionId, collectionTable.id),
      ),
    )
    .where(
      and(
        eq(connectionTable.userId, userId),
        eq(connectionTable.consumerId, consumerId),
        eq(connectionTable.collectionId, collectionId),
      ),
    )
    .limit(1);

  return connection;
}

/**
 * Update a connection.
 */
export async function updateConnection(
  userId: number,
  consumerId: number,
  collectionId: number,
  updates: ConnectionUpdate,
): Promise<Connection | undefined> {
  const [updated] = await db
    .update(connectionTable)
    .set(updates)
    .where(
      and(
        eq(connectionTable.userId, userId),
        eq(connectionTable.consumerId, consumerId),
        eq(connectionTable.collectionId, collectionId),
      ),
    )
    .returning();

  return updated;
}

/**
 * Delete a connection.
 */
export async function deleteConnection(
  userId: number,
  consumerId: number,
  collectionId: number,
): Promise<boolean> {
  const result = await db
    .delete(connectionTable)
    .where(
      and(
        eq(connectionTable.userId, userId),
        eq(connectionTable.consumerId, consumerId),
        eq(connectionTable.collectionId, collectionId),
      ),
    )
    .returning();

  return result.length > 0;
}

/**
 * Delete all connections for a consumer.
 */
export async function deleteConnectionsByConsumer(
  userId: number,
  consumerId: number,
): Promise<number> {
  const result = await db
    .delete(connectionTable)
    .where(and(eq(connectionTable.userId, userId), eq(connectionTable.consumerId, consumerId)))
    .returning();

  return result.length;
}

/**
 * Delete all connections for a collection.
 */
export async function deleteConnectionsByCollection(
  userId: number,
  collectionId: number,
): Promise<number> {
  const result = await db
    .delete(connectionTable)
    .where(and(eq(connectionTable.userId, userId), eq(connectionTable.collectionId, collectionId)))
    .returning();

  return result.length;
}
