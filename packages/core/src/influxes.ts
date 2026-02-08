import type { CollectionSchema } from "./collections";
import type { Filter } from "./filters";

/**
 * Influx details returned from list operations.
 * Includes resolved source collection and source names.
 */
export interface InfluxWithDetails {
  id: number;
  sourceCollectionId: number;
  sourceCollectionName: string;
  sourceCollectionRef: string | null;
  sourceId: number;
  sourceName: string | null;
  sourceType: number;
  schema: CollectionSchema | null;
  filters: Filter[] | null;
  includeRef: boolean | null;
  createdAt: Date;
}

/**
 * Full influx details including collection info.
 */
export interface InfluxDetails {
  id: number;
  userId: number;
  collectionId: number;
  sourceCollectionId: number;
  sourceCollectionName: string;
  sourceId: number;
  sourceName: string | null;
  schema: CollectionSchema | null;
  filters: Filter[] | null;
  includeRef: boolean | null;
  createdAt: Date;
  updatedAt: Date | null;
}
