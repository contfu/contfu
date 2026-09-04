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
  SourceUnavailable: 6,
});

export type IncidentType = EnumValue<typeof IncidentType>;

export const IncidentResolutionMode = defineEnum({
  Manual: 1,
  AutoResolvable: 2,
  Dismissible: 3,
});

export type IncidentResolutionMode = EnumValue<typeof IncidentResolutionMode>;

/** Specific reason a target delivery could not resolve its source item. */
export const SourceUnavailableReason = defineEnum({
  SourceMembershipMissing: 1,
  SourceCacheEntryMissing: 2,
  SourceCacheEntryExpired: 3,
  TargetFlowPathMissing: 4,
  TargetFlowPathRejectedItem: 5,
});

export type SourceUnavailableReason = EnumValue<typeof SourceUnavailableReason>;

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
export interface SourceUnavailableDetails {
  /** Managed item ID for the failed target delivery. */
  itemId: number;
  /** Stable key used to deduplicate retries for one delivery. */
  deliveryKey: string;
  /** Exact local source-resolution failure category, when recorded by a newer worker. */
  reason?: SourceUnavailableReason;
  /** Source-system item reference, when membership was available. */
  sourceRef?: string;
}

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
  sourceIntegrationId: string | null;
  sourceIntegrationName: string | null;
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

export const IncidentTypeName: Record<IncidentType, string> = {
  [IncidentType.SchemaIncompatible]: "schema_incompatible",
  [IncidentType.FilterInvalid]: "filter_invalid",
  [IncidentType.SyncError]: "sync_error",
  [IncidentType.ItemValidationError]: "item_validation_error",
  [IncidentType.SourceRepairFailure]: "source_repair_failure",
  [IncidentType.SourceUnavailable]: "source_unavailable",
};

export interface IncidentPresentationInput {
  type: IncidentType;
  message: string;
  details: Record<string, unknown> | null;
}

export interface IncidentPresentation {
  /** Stable textual incident type for public and terminal output. */
  typeName: string;
  problem: string;
  suggestedAction: string | null;
  affectedCount: number;
}

function nonEmptyText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function getIncidentResolutionItemProblem(value: unknown): string {
  if (!value || typeof value !== "object") return "Needs review.";
  const item = value as Record<string, unknown>;
  const problem = nonEmptyText(item.problem);
  if (problem) return problem;
  const source = nonEmptyText(item.source);
  const target = nonEmptyText(item.target);
  const property = nonEmptyText(item.property);
  if (source && target) return `Mapping from "${source}" to "${target}" needs review.`;
  if (source) return `Mapping source "${source}" needs review.`;
  if (property) return `Property "${property}" needs review.`;
  return "Needs review.";
}

function nestedResolutionItems(details: Record<string, unknown>): Record<string, unknown>[] {
  return [details.invalidMappings, details.invalidFilters, details.conflicts].flatMap((value) =>
    Array.isArray(value)
      ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      : [],
  );
}

/** Recognize current and legacy source-unavailable delivery incidents. */
export function isSourceUnavailableIncident(
  incident: Pick<IncidentPresentationInput, "type" | "message">,
): boolean {
  return (
    incident.type === IncidentType.SourceUnavailable ||
    incident.message === "Source item could not be resolved for target delivery" ||
    incident.message === "Source data is unavailable for target delivery"
  );
}

/** Parse the stable portion of source-unavailable details without trusting MessagePack contents. */
export function parseSourceUnavailableDetails(details: unknown): SourceUnavailableDetails | null {
  if (!details || typeof details !== "object") return null;
  const value = details as Partial<SourceUnavailableDetails>;
  if (typeof value.itemId !== "number" || !Number.isFinite(value.itemId)) return null;
  return {
    ...value,
    itemId: value.itemId,
    deliveryKey: value.deliveryKey ?? `target-delivery:${value.itemId}`,
  } as SourceUnavailableDetails;
}

export function sourceUnavailableProblem(details: SourceUnavailableDetails | null): string {
  switch (details?.reason) {
    case SourceUnavailableReason.SourceMembershipMissing:
      return "The source collection no longer has this item's membership.";
    case SourceUnavailableReason.SourceCacheEntryMissing:
      return "The source item is missing from Contfu's synced cache.";
    case SourceUnavailableReason.SourceCacheEntryExpired:
      return "The source item's cached data has expired.";
    case SourceUnavailableReason.TargetFlowPathMissing:
      return "This source collection no longer has a path to the target collection.";
    case SourceUnavailableReason.TargetFlowPathRejectedItem:
      return "The current flow no longer produces this target item.";
    default:
      return "Contfu could not resolve the source item needed for delivery.";
  }
}

/**
 * Turn type-dependent incident details into stable, data-oriented presentation fields.
 * Malformed and legacy details fall back to the incident's specific stored message.
 */
export function getIncidentPresentation(input: IncidentPresentationInput): IncidentPresentation {
  const details = input.details ?? {};
  const totalFailed = details.totalFailed;
  const affectedCount =
    typeof totalFailed === "number" && Number.isInteger(totalFailed) && totalFailed > 0
      ? totalFailed
      : 1;

  if (isSourceUnavailableIncident(input)) {
    return {
      typeName: IncidentTypeName[IncidentType.SourceUnavailable],
      problem: sourceUnavailableProblem(parseSourceUnavailableDetails(details)),
      suggestedAction:
        "Resync the source collection, then redeliver the affected item. This incident clears when that delivery succeeds.",
      affectedCount,
    };
  }

  const resolutionItems = nestedResolutionItems(details);
  const nestedProblems = resolutionItems.map(getIncidentResolutionItemProblem);
  const problem = nonEmptyText(details.problem) ?? (nestedProblems.join(" ") || input.message);
  const detailAction =
    nonEmptyText(details.suggestedAction) ??
    resolutionItems.map((item) => nonEmptyText(item.suggestedAction)).find(Boolean) ??
    null;
  const fallbackAction =
    input.type === IncidentType.SourceRepairFailure
      ? "Reset the source collection state and retry the sync."
      : input.type === IncidentType.ItemValidationError || input.type === IncidentType.SyncError
        ? "Fix the reported delivery problem, then dismiss this incident."
        : input.type === IncidentType.SchemaIncompatible ||
            input.type === IncidentType.FilterInvalid
          ? "Review the flow configuration and fix the reported incompatibility."
          : null;

  return {
    typeName: IncidentTypeName[input.type] ?? `unknown_${input.type}`,
    problem,
    suggestedAction: detailAction ?? fallbackAction,
    affectedCount,
  };
}
