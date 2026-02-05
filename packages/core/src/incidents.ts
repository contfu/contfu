import type { CollectionSchema } from "./collections";
import type { Filter } from "./filters";

/**
 * Types of incidents that can occur during data synchronization.
 * Values are integers stored in the database.
 */
export const IncidentType = {
  /** Schema changed in a way that invalidates existing filters */
  SchemaIncompatible: 1,
  /** Filter references a field that no longer exists */
  FilterInvalid: 2,
  /** General sync error */
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
 */
export interface IncidentWithDetails {
  id: number;
  influxId: number;
  collectionId: number;
  collectionName: string;
  sourceCollectionId: number;
  sourceCollectionName: string;
  type: IncidentType;
  message: string;
  details: Record<string, unknown> | null;
  resolved: boolean;
  createdAt: number;
  resolvedAt: number | null;
}
