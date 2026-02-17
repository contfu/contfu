import type { CollectionSchema } from "./schemas";
import type { Filter } from "./filters";

/**
 * Types of incidents that can occur during data synchronization.
 * Values are integers stored in the database.
 */
export const IncidentType = {
  SchemaIncompatible: 1,
  FilterInvalid: 2,
  SyncError: 3,
} as const;

export type IncidentType = (typeof IncidentType)[keyof typeof IncidentType];

/**
 * Details for schema incompatibility incidents.
 */
export interface SchemaIncompatibleDetails {
  oldSchema: CollectionSchema;
  newSchema: CollectionSchema;
  invalidFilters: Filter[];
}

/**
 * Incident record returned from list operations.
 * All ID fields are encoded strings (public-facing).
 */
export interface ServiceIncidentWithDetails {
  id: string;
  influxId: string;
  collectionId: string;
  collectionName: string;
  sourceCollectionId: string;
  sourceCollectionName: string;
  type: IncidentType;
  message: string;
  details: Record<string, unknown> | null;
  resolved: boolean;
  createdAt: Date;
  resolvedAt: Date | null;
}
