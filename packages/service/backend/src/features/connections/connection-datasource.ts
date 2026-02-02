import { db } from "../../infra/db/db";
import {
  collectionTable,
  connectionTable,
  consumerTable,
  type Connection,
} from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import type {
  BackendConnection,
  BackendConnectionWithDetails,
  CreateConnectionInput,
  UpdateConnectionInput,
} from "../../domain/types";

// =============================================================================
// Mappers (DB → Domain)
// =============================================================================

function mapToBackendConnection(connection: Connection): BackendConnection {
  return {
    userId: connection.userId,
    consumerId: connection.consumerId,
    collectionId: connection.collectionId,
    lastItemChanged: connection.lastItemChanged,
    lastConsistencyCheck: connection.lastConsistencyCheck,
  };
}

// =============================================================================
// Public Feature Functions (return domain types)
// =============================================================================

/**
 * Create a new connection for a user.
 */
export async function createConnection(
  userId: number,
  input: CreateConnectionInput,
): Promise<BackendConnection> {
  const [inserted] = await db
    .insert(connectionTable)
    .values({
      userId,
      consumerId: input.consumerId,
      collectionId: input.collectionId,
      lastItemChanged: input.lastItemChanged ?? null,
      lastConsistencyCheck: input.lastConsistencyCheck ?? null,
    })
    .returning();

  return mapToBackendConnection(inserted);
}

/**
 * Get all connections for a user with consumer and collection names.
 */
export async function listConnections(userId: number): Promise<BackendConnectionWithDetails[]> {
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
export async function listConnectionsByConsumer(
  userId: number,
  consumerId: number,
): Promise<BackendConnectionWithDetails[]> {
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
export async function listConnectionsByCollection(
  userId: number,
  collectionId: number,
): Promise<BackendConnectionWithDetails[]> {
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
export async function getConnection(
  userId: number,
  consumerId: number,
  collectionId: number,
): Promise<BackendConnection | undefined> {
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

  if (!connection) return undefined;

  return mapToBackendConnection(connection);
}

/**
 * Get a single connection with consumer and collection details.
 */
export async function getConnectionWithDetails(
  userId: number,
  consumerId: number,
  collectionId: number,
): Promise<BackendConnectionWithDetails | undefined> {
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
  input: UpdateConnectionInput,
): Promise<BackendConnection | undefined> {
  const [updated] = await db
    .update(connectionTable)
    .set(input)
    .where(
      and(
        eq(connectionTable.userId, userId),
        eq(connectionTable.consumerId, consumerId),
        eq(connectionTable.collectionId, collectionId),
      ),
    )
    .returning();

  if (!updated) return undefined;

  return mapToBackendConnection(updated);
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

// =============================================================================
// Legacy exports (deprecated - use new function names)
// =============================================================================

/** @deprecated Use createConnection instead */
export const insertConnection = createConnection;

/** @deprecated Use listConnections instead */
export const selectConnections = listConnections;

/** @deprecated Use listConnectionsByConsumer instead */
export const selectConnectionsByConsumer = listConnectionsByConsumer;

/** @deprecated Use listConnectionsByCollection instead */
export const selectConnectionsByCollection = listConnectionsByCollection;

/** @deprecated Use getConnection instead */
export const selectConnection = getConnection;

/** @deprecated Use getConnectionWithDetails instead */
export const selectConnectionWithDetails = getConnectionWithDetails;

// Re-export types for convenience
export type {
  BackendConnection,
  BackendConnectionWithDetails,
} from "../../domain/types";

// Legacy type aliases for backwards compatibility
export type NewConnection = CreateConnectionInput;
export type ConnectionUpdate = UpdateConnectionInput;
export type ConnectionWithDetails = BackendConnectionWithDetails;
