import { defineEnum, type EnumValue } from "@contfu/core";
import type { CollectionSchema } from "./schemas";
import type { Filter } from "./filters";
import type { MappingRule } from "./mappings";

export const FlowState = defineEnum({
  ACTIVE: 0,
  FROZEN: 1,
  CREDENTIAL_BLOCKED: 2,
  CAPABILITY_BLOCKED: 3,
  QUOTA_BLOCKED: 4,
});

export type FlowState = EnumValue<typeof FlowState>;

/**
 * Flow record returned from list operations.
 * All ID fields are encoded strings (public-facing).
 */
export interface ServiceFlow {
  id: string;
  sourceId: string;
  targetId: string;
  state: FlowState;
  schema: CollectionSchema | null;
  mappings: MappingRule[] | null;
  filters: Filter[] | null;
  createdAt: Date;
  updatedAt: Date | null;
}

/**
 * Flow with resolved source/target collection details.
 * All ID fields are encoded strings (public-facing).
 */
export interface ServiceFlowWithDetails extends ServiceFlow {
  /** Current source collection schema for mapping/filter editors. */
  sourceSchema?: CollectionSchema | null;
  sourceCollectionName: string;
  sourceCollectionDisplayName: string;
  sourceIntegrationType: number | null;
  targetCollectionName: string;
  targetCollectionDisplayName: string;
  targetIntegrationType: number | null;
}
