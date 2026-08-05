import type { CollectionSchema, SchemaValue } from "./schemas";
import type { Filter } from "./filters";
import type { MappingRule } from "./mappings";
import type { CollectionI18nConfig, IntegrationI18nConfig } from "./i18n";
import type { IntegrationCapability, IntegrationRole } from "@contfu/core";

/** Status summary returned by GET /api/v1/status */
export interface ApiStatus {
  integrations: number;
  collections: number;
  flows: number;
}

export interface ApiWorkspace {
  id: string;
  organizationId: string;
  organizationDisplayName?: string;
  displayName: string;
  name: string;
  isDefault: boolean;
  organizationRole: number;
  isJoined: boolean;
  canManage: boolean;
  maxIntegrations: number | null;
  maxCollections: number | null;
  maxFlows: number | null;
  maxItems: number | null;
  maxItemChanges: number | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateWorkspaceBody {
  organizationId?: string;
  displayName: string;
  name?: string;
}

export interface UpdateWorkspaceBody {
  displayName?: string;
  name?: string;
  maxIntegrations?: number | null;
  maxCollections?: number | null;
  maxFlows?: number | null;
  maxItems?: number | null;
  maxItemChanges?: number | null;
}

export interface CreateWorkspaceInvitationBody {
  email: string;
}

export interface CreateWorkspaceInvitationResult {
  id: string;
  email: string;
  token: string;
  expiresAt: string;
}

export interface ApiOrganization {
  id: string;
  displayName: string;
  name: string;
  avatar: string | null;
  role: number;
  canManage: boolean;
  canManageAdmins: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface ApiOrganizationMember {
  name: string;
  email: string;
  role: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface ApiWorkspaceMember {
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateOrganizationBody {
  displayName: string;
  name?: string;
}

export interface UpdateOrganizationBody {
  displayName?: string;
  name?: string;
  avatar?: string | null;
}

export interface CreateOrganizationInvitationBody {
  email: string;
  role?: number;
}

export interface CreateOrganizationInvitationResult {
  id: string;
  email: string;
  role: number;
  token: string;
  expiresAt: string;
}

export interface WordPressIntegrationOpts {
  graphqlAvailable?: boolean;
  graphqlEndpoint?: string | null;
  modifiedAfterAvailable?: boolean;
  modifiedAfterCollections?: string[];
  /** Include non-published post/media statuses and expose $draft. Defaults to false. */
  includeDrafts?: boolean;
}

export interface SanityIntegrationOpts {
  projectId?: string;
  /** Include draft documents and expose $draft. Defaults to true. */
  includeDrafts?: boolean;
  typeAllowlist?: string[];
  typeMapping?: Record<string, string>;
  pushVerifiedAt?: string;
  lastSchemaPushAt?: string;
}

export interface ContentfulIntegrationOpts {
  spaceId?: string;
  apiMode?: "delivery" | "preview";
  token?: string;
  preview?: boolean;
  deliveryToken?: string;
  previewToken?: string;
  managementToken?: string;
  contentTypeMap?: Record<string, string>;
  webhookSecret?: string;
}

export interface StrapiIntegrationOpts {
  includeDrafts?: boolean;
  lastPush?: string;
}

export interface WebhookTargetIntegrationOpts {
  headers?: Record<string, string>;
  maxAttempts?: number;
  deliveryWindow?: number;
}

export interface IntegrationOpts
  extends
    WordPressIntegrationOpts,
    SanityIntegrationOpts,
    ContentfulIntegrationOpts,
    StrapiIntegrationOpts,
    WebhookTargetIntegrationOpts {}

/** Integration record returned by the service API */
export interface ServiceScope {
  value: string;
  label: string;
}

export interface IntegrationCapabilityState {
  supported: IntegrationCapability[];
  granted: IntegrationCapability[];
  enabled: IntegrationCapability[];
  disabledReasons?: Partial<Record<IntegrationCapability, string>>;
}

export interface ApiTargetFailedDelivery {
  id: string;
  workspaceId: string;
  collectionId: string;
  itemId: number;
  attempts: number;
  lastError: string | null;
  lastAttemptAt: string | null;
}

export interface ApiIntegration {
  id: string;
  name: string;
  type: number;
  mode: number;
  scopes: string[];
  accountId: string | null;
  url: string | null;
  opts: IntegrationOpts | null;
  hasCredentials: boolean;
  roles?: IntegrationRole[];
  capabilities?: IntegrationCapabilityState;
  i18n?: IntegrationI18nConfig;
  createdAt: string;
  updatedAt: string | null;
}

// --- Request body types ---

export interface CreateIntegrationBody {
  name: string;
  type: number;
  mode?: number;
  scopes?: string[];
  accountId?: string | null;
  url?: string | null;
  i18n?: IntegrationI18nConfig;
  opts?: IntegrationOpts | null;
  credentials?: string;
  webhookSecret?: string;
}

export interface UpdateIntegrationBody {
  name?: string;
  mode?: number;
  scopes?: string[];
  i18n?: IntegrationI18nConfig;
  opts?: IntegrationOpts | null;
  credentials?: string;
  webhookSecret?: string;
}

export interface CreateCollectionBody {
  displayName: string;
  name?: string;
  integrationId?: string | null;
  includeContent?: boolean;
  i18n?: CollectionI18nConfig;
}

export interface UpdateCollectionBody {
  displayName?: string;
  name?: string;
  includeContent?: boolean;
  schema?: CollectionSchema;
  refTargets?: Record<string, string[]> | null;
  i18n?: CollectionI18nConfig;
}

export interface CreateFlowBody {
  sourceId: string;
  targetId: string;
  filters?: Filter[];
  mappings?: MappingRule[] | null;
}

export interface UpdateFlowBody {
  filters?: Filter[] | null;
  mappings?: MappingRule[] | null;
}

/** A collection available to scan from a CMS integration. */
export interface ScannedCollection {
  ref: string;
  displayName: string;
  scope?: string | null;
  alreadyAdded: boolean;
  icon?: { type: "emoji"; value: string } | { type: "image"; url: string } | null;
  schema?: Record<string, SchemaValue> | null;
  i18n?: CollectionI18nConfig | null;
  locales?: string[];
  refTargets?: Record<string, string[]> | null;
  options?: Record<string, unknown> | null;
}

export interface AddScannedCollectionsBody {
  refs?: string[];
  all?: boolean;
}

export interface AddedScannedCollection {
  ref: string;
  id: string;
  displayName: string;
  scope?: string | null;
}

export interface AddScannedCollectionsResult {
  added: AddedScannedCollection[];
  alreadyAdded: ScannedCollection[];
  scanned: number;
}

/** Error thrown by the API client when the server returns a non-ok response. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ServiceComponent {
  id: string;
  workspaceId: string;
  integrationId: string;
  serviceRef: string;
  name: string;
  displayName: string;
  status: number;
  propsSchema: CollectionSchema;
  mapping: MappingRule[] | null;
}

export interface CreateComponentBody {
  serviceRef: string;
  name: string;
  displayName: string;
  propsSchema?: CollectionSchema;
  mapping?: MappingRule[] | null;
}

export interface UpdateComponentBody {
  name?: string;
  displayName?: string;
  status?: number;
  propsSchema?: CollectionSchema;
  mapping?: MappingRule[] | null;
}
