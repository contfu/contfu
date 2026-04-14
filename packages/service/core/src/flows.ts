import type { CollectionSchema } from "./schemas";
import type { Filter } from "./filters";
import type { MappingRule } from "./mappings";

/**
 * Flow record returned from list operations.
 * All ID fields are encoded strings (public-facing).
 */
export interface ServiceFlow {
  id: string;
  sourceId: string;
  targetId: string;
  schema: CollectionSchema | null;
  mappings: MappingRule[] | null;
  filters: Filter[] | null;
  includeRef: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

/**
 * Flow with resolved source/target collection details.
 * All ID fields are encoded strings (public-facing).
 */
export interface ServiceFlowWithDetails extends ServiceFlow {
  sourceCollectionName: string;
  sourceCollectionDisplayName: string;
  sourceConnectionType: number | null;
  targetCollectionName: string;
  targetCollectionDisplayName: string;
  targetConnectionType: number | null;
}
