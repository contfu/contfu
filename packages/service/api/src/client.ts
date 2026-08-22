import type {
  ApiStatus,
  ApiIntegration,
  CreateIntegrationBody,
  UpdateIntegrationBody,
  CreateCollectionBody,
  UpdateCollectionBody,
  CreateFlowBody,
  UpdateFlowBody,
  ServiceCollection,
  ServiceFlow,
  ServiceFlowWithDetails,
  TypeGenerationInput,
  ScannedCollection,
  AddScannedCollectionsBody,
  AddScannedCollectionsResult,
  ApiWorkspace,
  ApiOrganization,
  ApiOrganizationMember,
  ApiWorkspaceMember,
  CreateOrganizationBody,
  UpdateOrganizationBody,
  CreateOrganizationInvitationBody,
  CreateOrganizationInvitationResult,
  CreateWorkspaceBody,
  UpdateWorkspaceBody,
  CreateWorkspaceInvitationBody,
  CreateWorkspaceInvitationResult,
  CollectionSchema,
  MappingRule,
  CreateComponentBody,
  ApiTargetFailedDelivery,
} from "@contfu/svc-core";
import { ApiError } from "@contfu/svc-core";

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

export interface UpdateComponentBody {
  name?: string;
  displayName?: string;
  status?: number;
  propsSchema?: CollectionSchema;
  mapping?: MappingRule[] | null;
}

type FetchFn = typeof globalThis.fetch;

async function request<T>(
  fetchFn: FetchFn,
  baseUrl: string,
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };
  try {
    headers.Origin = new URL(baseUrl).origin;
  } catch {
    // Relative base URLs are valid for browser-relative fetchers but have no origin header.
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetchFn(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const text = await res.text();
      const json = JSON.parse(text) as { message?: string };
      if (json.message) message = json.message;
      else if (text) message = text;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, message);
  }

  const text = await res.text();
  if (!text) return undefined as T;
  if (!res.headers.get("content-type")?.includes("application/json")) return text as T;
  return JSON.parse(text) as T;
}

function withWorkspace(path: string, workspaceId?: string | null): string {
  if (!workspaceId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}workspace=${encodeURIComponent(workspaceId)}`;
}

export interface CreateAppResult extends ApiIntegration {
  apiKey: string;
}

export interface RegenerateKeyResult {
  apiKey: string;
}

export interface ContfuApiClient {
  getStatus(): Promise<ApiStatus>;

  listIntegrations(): Promise<ApiIntegration[]>;
  getIntegration(id: string): Promise<ApiIntegration>;
  createIntegration(body: CreateIntegrationBody): Promise<ApiIntegration>;
  createAppIntegration(name: string): Promise<CreateAppResult>;
  regenerateAppKey(id: string): Promise<RegenerateKeyResult>;
  updateIntegration(id: string, body: UpdateIntegrationBody): Promise<ApiIntegration>;
  deleteIntegration(id: string): Promise<void>;
  getIntegrationTypes(id: string): Promise<TypeGenerationInput[]>;
  scanCollections(integrationId: string): Promise<ScannedCollection[]>;
  addScannedCollections(
    integrationId: string,
    body: AddScannedCollectionsBody,
  ): Promise<AddScannedCollectionsResult>;
  listIntegrationComponents(integrationId: string): Promise<ServiceComponent[]>;
  createComponent(integrationId: string, body: CreateComponentBody): Promise<ServiceComponent>;
  getComponent(id: string): Promise<ServiceComponent>;
  updateComponent(id: string, body: UpdateComponentBody): Promise<ServiceComponent>;
  deleteComponent(id: string): Promise<void>;

  listTargetFailedDeliveries(input?: {
    integrationId?: string;
  }): Promise<ApiTargetFailedDelivery[]>;
  redeliverTargetFailedDelivery(id: string): Promise<{ accepted: number }>;
  clearTargetFailedDelivery(id: string): Promise<void>;

  listCollections(): Promise<ServiceCollection[]>;
  getCollection(id: string): Promise<ServiceCollection>;
  createCollection(body: CreateCollectionBody): Promise<ServiceCollection>;
  updateCollection(id: string, body: UpdateCollectionBody): Promise<ServiceCollection>;
  deleteCollection(id: string): Promise<void>;
  getCollectionTypes(id: string): Promise<string>;

  listFlows(): Promise<ServiceFlow[]>;
  getFlow(id: string): Promise<ServiceFlowWithDetails>;
  createFlow(body: CreateFlowBody): Promise<ServiceFlow>;
  updateFlow(id: string, body: UpdateFlowBody): Promise<ServiceFlow>;
  deleteFlow(id: string): Promise<void>;

  listWorkspaces(): Promise<ApiWorkspace[]>;
  listOrganizations(): Promise<ApiOrganization[]>;
  createOrganization(body: CreateOrganizationBody): Promise<ApiOrganization>;
  updateOrganization(id: string, body: UpdateOrganizationBody): Promise<ApiOrganization>;
  listOrganizationMembers(id: string): Promise<ApiOrganizationMember[]>;
  updateOrganizationMemberRole(
    organizationId: string,
    email: string,
    role: number,
  ): Promise<ApiOrganizationMember>;
  inviteOrganizationMember(
    organizationId: string,
    body: CreateOrganizationInvitationBody,
  ): Promise<CreateOrganizationInvitationResult>;
  acceptOrganizationInvitation(token: string): Promise<{ organizationId: string }>;
  createWorkspace(body: CreateWorkspaceBody): Promise<ApiWorkspace>;
  updateWorkspace(id: string, body: UpdateWorkspaceBody): Promise<ApiWorkspace>;
  joinWorkspace(id: string): Promise<{ workspaceId: string }>;
  listWorkspaceMembers(id: string): Promise<ApiWorkspaceMember[]>;
  revokeWorkspaceMember(id: string, email: string): Promise<void>;
  inviteWorkspaceMember(
    workspaceId: string,
    body: CreateWorkspaceInvitationBody,
  ): Promise<CreateWorkspaceInvitationResult>;
  acceptWorkspaceInvitation(token: string): Promise<{ workspaceId: string }>;
}

export function createApiClient(
  baseUrl: string,
  apiKey: string,
  fetchFn: FetchFn = globalThis.fetch,
  workspaceId?: string | null,
): ContfuApiClient {
  const req = <T>(method: string, path: string, body?: unknown) =>
    request<T>(fetchFn, baseUrl, apiKey, method, withWorkspace(path, workspaceId), body);
  const unscopedReq = <T>(method: string, path: string, body?: unknown) =>
    request<T>(fetchFn, baseUrl, apiKey, method, path, body);

  return {
    getStatus: () => req<ApiStatus>("GET", "/api/v1/status"),

    listIntegrations: () => req<ApiIntegration[]>("GET", "/api/v1/integrations"),
    getIntegration: (id) => req<ApiIntegration>("GET", `/api/v1/integrations/${id}`),
    createIntegration: (body) => req<ApiIntegration>("POST", "/api/v1/integrations", body),
    createAppIntegration: (name) =>
      req<CreateAppResult>("POST", "/api/v1/integrations/app", { name }),
    regenerateAppKey: (id) =>
      req<RegenerateKeyResult>("POST", `/api/v1/integrations/${id}/regenerate-key`),
    updateIntegration: (id, body) =>
      req<ApiIntegration>("PATCH", `/api/v1/integrations/${id}`, body),
    deleteIntegration: (id) => req<void>("DELETE", `/api/v1/integrations/${id}`),
    getIntegrationTypes: (id) =>
      req<TypeGenerationInput[]>("GET", `/api/v1/integrations/${id}/types`),
    scanCollections: (integrationId) =>
      req<ScannedCollection[]>("GET", `/api/v1/integrations/${integrationId}/scan`),
    addScannedCollections: (integrationId, body) =>
      req<AddScannedCollectionsResult>("POST", `/api/v1/integrations/${integrationId}/add`, body),
    listIntegrationComponents: (integrationId) =>
      req<ServiceComponent[]>("GET", `/api/v1/integrations/${integrationId}/components`),
    createComponent: (integrationId, body) =>
      req<ServiceComponent>("POST", `/api/v1/integrations/${integrationId}/components`, body),
    getComponent: (id) => req<ServiceComponent>("GET", `/api/v1/components/${id}`),
    updateComponent: (id, body) => req<ServiceComponent>("PATCH", `/api/v1/components/${id}`, body),
    deleteComponent: (id) => req<void>("DELETE", `/api/v1/components/${id}`),

    listTargetFailedDeliveries: (input = {}) => {
      const query = input.integrationId
        ? `?integration=${encodeURIComponent(input.integrationId)}`
        : "";
      return req<ApiTargetFailedDelivery[]>("GET", `/api/v1/target-deliveries/failed${query}`);
    },
    redeliverTargetFailedDelivery: (id) =>
      req<{ accepted: number }>("POST", `/api/v1/target-deliveries/failed/${id}`, {
        action: "redeliver",
      }),
    clearTargetFailedDelivery: (id) =>
      req<void>("DELETE", `/api/v1/target-deliveries/failed/${id}`),

    listCollections: () => req<ServiceCollection[]>("GET", "/api/v1/collections"),
    getCollection: (id) => req<ServiceCollection>("GET", `/api/v1/collections/${id}`),
    createCollection: (body) => req<ServiceCollection>("POST", "/api/v1/collections", body),
    updateCollection: (id, body) =>
      req<ServiceCollection>("PATCH", `/api/v1/collections/${id}`, body),
    deleteCollection: (id) => req<void>("DELETE", `/api/v1/collections/${id}`),
    getCollectionTypes: (id) => req<string>("GET", `/api/v1/collections/${id}/types`),

    listFlows: () => req<ServiceFlow[]>("GET", "/api/v1/flows"),
    getFlow: (id) => req<ServiceFlowWithDetails>("GET", `/api/v1/flows/${id}`),
    createFlow: (body) => req<ServiceFlow>("POST", "/api/v1/flows", body),
    updateFlow: (id, body) => req<ServiceFlow>("PATCH", `/api/v1/flows/${id}`, body),
    deleteFlow: (id) => req<void>("DELETE", `/api/v1/flows/${id}`),

    listOrganizations: () => unscopedReq<ApiOrganization[]>("GET", "/api/v1/organizations"),
    createOrganization: (body) =>
      unscopedReq<ApiOrganization>("POST", "/api/v1/organizations", body),
    updateOrganization: (id, body) =>
      unscopedReq<ApiOrganization>("PATCH", `/api/v1/organizations/${id}`, body),
    listOrganizationMembers: (id) =>
      unscopedReq<ApiOrganizationMember[]>("GET", `/api/v1/organizations/${id}/members`),
    updateOrganizationMemberRole: (organizationId, email, role) =>
      unscopedReq<ApiOrganizationMember>(
        "PATCH",
        `/api/v1/organizations/${organizationId}/members/${encodeURIComponent(email)}`,
        { role },
      ),
    inviteOrganizationMember: (organizationId, body) =>
      unscopedReq<CreateOrganizationInvitationResult>(
        "POST",
        `/api/v1/organizations/${organizationId}/invitations`,
        body,
      ),
    acceptOrganizationInvitation: (token) =>
      unscopedReq<{ organizationId: string }>("POST", "/api/v1/organization-invitations/accept", {
        token,
      }),

    listWorkspaces: () => unscopedReq<ApiWorkspace[]>("GET", "/api/v1/workspaces"),
    createWorkspace: (body) => unscopedReq<ApiWorkspace>("POST", "/api/v1/workspaces", body),
    updateWorkspace: (id, body) =>
      unscopedReq<ApiWorkspace>("PATCH", `/api/v1/workspaces/${id}`, body),
    joinWorkspace: (id) =>
      unscopedReq<{ workspaceId: string }>("POST", `/api/v1/workspaces/${id}/join`),
    listWorkspaceMembers: (id) =>
      unscopedReq<ApiWorkspaceMember[]>("GET", `/api/v1/workspaces/${id}/members`),
    revokeWorkspaceMember: (id, email) =>
      unscopedReq<void>("DELETE", `/api/v1/workspaces/${id}/members/${encodeURIComponent(email)}`),
    inviteWorkspaceMember: (workspaceId, body) =>
      unscopedReq<CreateWorkspaceInvitationResult>(
        "POST",
        `/api/v1/workspaces/${workspaceId}/invitations`,
        body,
      ),
    acceptWorkspaceInvitation: (token) =>
      unscopedReq<{ workspaceId: string }>("POST", "/api/v1/workspace-invitations/accept", {
        token,
      }),
  };
}
