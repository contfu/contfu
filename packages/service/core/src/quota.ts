export type QuotaStatus = "ok" | "near_limit" | "over_limit" | "blocked";

export type QuotaResourceStatus = {
  allowed: boolean;
  current: number;
  max: number;
  status: QuotaStatus;
  overBy: number;
  reason: string;
  resetAt?: number;
  resetIntervalSeconds?: number;
};

export type QuotaState = {
  workspaces: number;
  maxWorkspaces: number;
  organizationMembers: number;
  maxOrganizationMembers: number;
  workspaceMembers: number;
  maxWorkspaceMembers: number;
  integrations: number;
  maxIntegrations: number;
  collections: number;
  maxCollections: number;
  flows: number;
  maxFlows: number;
  /** Total tenant item inventory. */
  items: number;
  maxItems: number;
  /** Per-collection item inventory limit. */
  collectionItems?: number;
  maxItemsPerCollection?: number;
  /** Period-based item change volume. */
  itemChanges: number;
  maxItemChanges: number;
  /** Next item change quota reset boundary, as a Unix timestamp in seconds. */
  itemChangesResetAt: number;
  /** Item change quota reset interval, in seconds. */
  itemChangesResetIntervalSeconds: number;
  periodEnd: number;
  planTier: number;
  planKind: "free" | "paid";
  subscriptionStatus: string | null;
  resources?: {
    workspaces: QuotaResourceStatus;
    organizationMembers: QuotaResourceStatus;
    workspaceMembers: QuotaResourceStatus;
    integrations: QuotaResourceStatus;
    collections: QuotaResourceStatus;
    flows: QuotaResourceStatus;
    items: QuotaResourceStatus;
    collectionItems: QuotaResourceStatus;
    itemChanges: QuotaResourceStatus;
  };
};

export type WorkspaceQuotaResourceName =
  | "integrations"
  | "collections"
  | "flows"
  | "items"
  | "itemChanges";

export type WorkspaceQuotaLimitSource =
  | "workspace_budget"
  | "organization_capacity"
  | "organization_plan"
  | "unlimited"
  | "admin_managed";

export type WorkspaceQuotaResource = {
  current: number;
  /** Compatibility display/enforcement limit. Prefer effectiveMax for new callers. */
  max: number | null;
  /** Effective limit visible to the current user, or null when intentionally hidden. */
  effectiveMax: number | null;
  budget: number | null;
  available: number | null;
  orgLimit: number;
  limitSource: WorkspaceQuotaLimitSource;
  limitLabel: string;
  actionHref: string | null;
  status: QuotaStatus;
  allowed: boolean;
  ownerOnlyLimit: boolean;
};

export type WorkspaceQuotaSummary = {
  workspaceId: string;
  organizationId: string;
  organizationRole: number;
  canManage: boolean;
  /** Organization-wide item-change usage, distinct from the selected workspace budget. */
  organizationItemChangesQuota?: QuotaResourceStatus;
  resources: Record<WorkspaceQuotaResourceName, WorkspaceQuotaResource>;
};
