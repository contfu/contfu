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
  DiscoveredCollection,
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

export interface ContfuApiClient {
  getStatus(): Promise<ApiStatus>;

  listConnections(): Promise<ApiConnection[]>;
  getConnection(id: number | string): Promise<ApiConnection>;
  createConnection(body: CreateConnectionBody): Promise<ApiConnection>;
  updateConnection(id: number | string, body: UpdateConnectionBody): Promise<ApiConnection>;
  deleteConnection(id: number | string): Promise<void>;
  getConnectionTypes(id: number | string): Promise<TypeGenerationInput[]>;
  discoverCollections(connectionId: number | string): Promise<DiscoveredCollection[]>;

  listCollections(): Promise<ServiceCollection[]>;
  getCollection(id: number | string): Promise<ServiceCollection>;
  createCollection(body: CreateCollectionBody): Promise<ServiceCollection>;
  updateCollection(id: number | string, body: UpdateCollectionBody): Promise<ServiceCollection>;
  deleteCollection(id: number | string): Promise<void>;
  getCollectionTypes(id: number | string): Promise<TypeGenerationInput[]>;

  listFlows(): Promise<ServiceFlow[]>;
  getFlow(id: number | string): Promise<ServiceFlowWithDetails>;
  createFlow(body: CreateFlowBody): Promise<ServiceFlow>;
  updateFlow(id: number | string, body: UpdateFlowBody): Promise<ServiceFlow>;
  deleteFlow(id: number | string): Promise<void>;
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
    updateConnection: (id, body) => req<ApiConnection>("PATCH", `/api/v1/connections/${id}`, body),
    deleteConnection: (id) => req<void>("DELETE", `/api/v1/connections/${id}`),
    getConnectionTypes: (id) =>
      req<TypeGenerationInput[]>("GET", `/api/v1/connections/${id}/types`),
    discoverCollections: (connectionId) =>
      req<DiscoveredCollection[]>("GET", `/api/v1/connections/${connectionId}/discover`),

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
