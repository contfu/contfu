import type { CollectionSchema } from "./schemas";
import type { Filter } from "./filters";

/**
 * Influx details returned from list operations.
 * Includes resolved source collection and source names.
 * All ID fields are encoded strings (public-facing).
 */
export interface ServiceInfluxWithDetails {
  id: string;
  sourceCollectionId: string;
  sourceCollectionName: string;
  sourceCollectionRef: string | null;
  sourceId: string;
  sourceName: string | null;
  sourceType: number;
  schema: CollectionSchema | null;
  filters: Filter[] | null;
  includeRef: boolean;
  createdAt: Date;
}

/**
 * Full influx details including collection info.
 * All ID fields are encoded strings (public-facing).
 */
export interface ServiceInfluxDetails {
  id: string;
  userId: string;
  collectionId: string;
  sourceCollectionId: string;
  sourceCollectionName: string;
  sourceId: string;
  sourceName: string | null;
  schema: CollectionSchema | null;
  filters: Filter[] | null;
  includeRef: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}
