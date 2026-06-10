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
  connections: number;
  maxConnections: number;
  collections: number;
  maxCollections: number;
  flows: number;
  maxFlows: number;
  /** Total tenant item inventory. */
  items: number;
  maxItems: number;
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
    connections: QuotaResourceStatus;
    collections: QuotaResourceStatus;
    flows: QuotaResourceStatus;
    items: QuotaResourceStatus;
    itemChanges: QuotaResourceStatus;
  };
};

export type WorkspaceQuotaResourceName =
  | "connections"
  | "collections"
  | "flows"
  | "items"
  | "itemChanges";

export type WorkspaceQuotaResource = {
  current: number;
  max: number | null;
  budget: number | null;
  available: number | null;
  orgLimit: number;
  status: QuotaStatus;
  allowed: boolean;
  ownerOnlyLimit: boolean;
};

export type WorkspaceQuotaSummary = {
  workspaceId: string;
  organizationId: string;
  organizationRole: number;
  canManage: boolean;
  resources: Record<WorkspaceQuotaResourceName, WorkspaceQuotaResource>;
};
