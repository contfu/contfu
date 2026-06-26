import { defineEnum, type EnumValue } from "@contfu/core";
import type { CollectionSchema } from "./schemas";
import type { Filter } from "./filters";
import type { MappingRule } from "./mappings";
import { FlowState, type FlowState as FlowStateValue } from "./flows";

/**
 * Types of incidents that can occur during data synchronization.
 * Values are integers stored in the database.
 */
export const IncidentType = defineEnum({
  SchemaIncompatible: 1,
  FilterInvalid: 2,
  SyncError: 3,
  ItemValidationError: 4,
  SourceRepairFailure: 5,
});

export type IncidentType = EnumValue<typeof IncidentType>;

export const IncidentResolutionMode = defineEnum({
  Manual: 1,
  AutoResolvable: 2,
  Dismissible: 3,
});

export type IncidentResolutionMode = EnumValue<typeof IncidentResolutionMode>;

export const getIncidentResolutionMode = (
  type: IncidentType,
  flowState: FlowStateValue,
): IncidentResolutionMode => {
  if (type === IncidentType.SchemaIncompatible) {
    return flowState === FlowState.FROZEN
      ? IncidentResolutionMode.Manual
      : IncidentResolutionMode.AutoResolvable;
  }

  if (type === IncidentType.ItemValidationError || type === IncidentType.SyncError) {
    return IncidentResolutionMode.Dismissible;
  }

  // A Source Repair Failure is only cleared by a successful Reset Source State
  // retry; users cannot dismiss it while the source Collection remains untrusted.
  if (type === IncidentType.SourceRepairFailure) {
    return IncidentResolutionMode.Manual;
  }

  return IncidentResolutionMode.AutoResolvable;
};

/**
 * Details for schema incompatibility incidents.
 */
export interface IncidentResolutionItem {
  property?: string;
  source?: string;
  target?: string;
  problem: string;
  suggestedAction?: string;
}

export interface SchemaIncompatibleDetails {
  oldSchema: CollectionSchema;
  newSchema: CollectionSchema;
  invalidFilters: Filter[] | IncidentResolutionItem[];
  invalidMappings?: MappingRule[] | IncidentResolutionItem[];
  conflicts?: IncidentResolutionItem[];
  problem?: string;
  suggestedAction?: string;
  resolutionHref?: string;
}

/**
 * Details for item validation error incidents.
 * `sampleRefs` is a msgpackr-packed `[number, string][]` (timestamp + ref ID pairs).
 */
export interface ItemValidationErrorDetails {
  property: string;
  cast: string;
  sourceProperty: string;
  totalFailed: number;
  sampleRefs: Buffer;
}

/**
 * Incident record returned from list operations.
 * All ID fields are encoded strings (public-facing).
 */
export interface ServiceIncidentWithDetails {
  id: string;
  flowId: string;
  sourceCollectionId: string;
  sourceCollectionName: string;
  targetCollectionId: string;
  targetCollectionName: string;
  type: IncidentType;
  resolutionMode: IncidentResolutionMode;
  message: string;
  details: Record<string, unknown> | null;
  resolved: boolean;
  createdAt: Date;
  resolvedAt: Date | null;
}
