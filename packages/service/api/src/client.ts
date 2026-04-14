import type {
  ApiStatus,
  ApiConnection,
  CreateConnectionBody,
  UpdateConnectionBody,
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
} from "@contfu/svc-core";
import { ApiError } from "@contfu/svc-core";

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
  return JSON.parse(text) as T;
}

export interface CreateAppResult extends ApiConnection {
  apiKey: string;
}

export interface RegenerateKeyResult {
  apiKey: string;
}

export interface ContfuApiClient {
  getStatus(): Promise<ApiStatus>;

  listConnections(): Promise<ApiConnection[]>;
  getConnection(id: string): Promise<ApiConnection>;
  createConnection(body: CreateConnectionBody): Promise<ApiConnection>;
  createAppConnection(name: string): Promise<CreateAppResult>;
  regenerateAppKey(id: string): Promise<RegenerateKeyResult>;
  updateConnection(id: string, body: UpdateConnectionBody): Promise<ApiConnection>;
  deleteConnection(id: string): Promise<void>;
  getConnectionTypes(id: string): Promise<TypeGenerationInput[]>;
  scanCollections(connectionId: string): Promise<ScannedCollection[]>;
  addScannedCollections(
    connectionId: string,
    body: AddScannedCollectionsBody,
  ): Promise<AddScannedCollectionsResult>;

  listCollections(): Promise<ServiceCollection[]>;
  getCollection(id: string): Promise<ServiceCollection>;
  createCollection(body: CreateCollectionBody): Promise<ServiceCollection>;
  updateCollection(id: string, body: UpdateCollectionBody): Promise<ServiceCollection>;
  deleteCollection(id: string): Promise<void>;
  getCollectionTypes(id: string): Promise<TypeGenerationInput[]>;

  listFlows(): Promise<ServiceFlow[]>;
  getFlow(id: string): Promise<ServiceFlowWithDetails>;
  createFlow(body: CreateFlowBody): Promise<ServiceFlow>;
  updateFlow(id: string, body: UpdateFlowBody): Promise<ServiceFlow>;
  deleteFlow(id: string): Promise<void>;
}

export function createApiClient(
  baseUrl: string,
  apiKey: string,
  fetchFn: FetchFn = globalThis.fetch,
): ContfuApiClient {
  const req = <T>(method: string, path: string, body?: unknown) =>
    request<T>(fetchFn, baseUrl, apiKey, method, path, body);

  return {
    getStatus: () => req<ApiStatus>("GET", "/api/v1/status"),

    listConnections: () => req<ApiConnection[]>("GET", "/api/v1/connections"),
    getConnection: (id) => req<ApiConnection>("GET", `/api/v1/connections/${id}`),
    createConnection: (body) => req<ApiConnection>("POST", "/api/v1/connections", body),
    createAppConnection: (name) =>
      req<CreateAppResult>("POST", "/api/v1/connections/app", { name }),
    regenerateAppKey: (id) =>
      req<RegenerateKeyResult>("POST", `/api/v1/connections/${id}/regenerate-key`),
    updateConnection: (id, body) => req<ApiConnection>("PATCH", `/api/v1/connections/${id}`, body),
    deleteConnection: (id) => req<void>("DELETE", `/api/v1/connections/${id}`),
    getConnectionTypes: (id) =>
      req<TypeGenerationInput[]>("GET", `/api/v1/connections/${id}/types`),
    scanCollections: (connectionId) =>
      req<ScannedCollection[]>("GET", `/api/v1/connections/${connectionId}/scan`),
    addScannedCollections: (connectionId, body) =>
      req<AddScannedCollectionsResult>("POST", `/api/v1/connections/${connectionId}/add`, body),

    listCollections: () => req<ServiceCollection[]>("GET", "/api/v1/collections"),
    getCollection: (id) => req<ServiceCollection>("GET", `/api/v1/collections/${id}`),
    createCollection: (body) => req<ServiceCollection>("POST", "/api/v1/collections", body),
    updateCollection: (id, body) =>
      req<ServiceCollection>("PATCH", `/api/v1/collections/${id}`, body),
    deleteCollection: (id) => req<void>("DELETE", `/api/v1/collections/${id}`),
    getCollectionTypes: (id) =>
      req<TypeGenerationInput[]>("GET", `/api/v1/collections/${id}/types`),

    listFlows: () => req<ServiceFlow[]>("GET", "/api/v1/flows"),
    getFlow: (id) => req<ServiceFlowWithDetails>("GET", `/api/v1/flows/${id}`),
    createFlow: (body) => req<ServiceFlow>("POST", "/api/v1/flows", body),
    updateFlow: (id, body) => req<ServiceFlow>("PATCH", `/api/v1/flows/${id}`, body),
    deleteFlow: (id) => req<void>("DELETE", `/api/v1/flows/${id}`),
  };
}
