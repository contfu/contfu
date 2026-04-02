import type { CollectionSchema, SchemaValue } from "./schemas";
import type { Filter } from "./filters";
import type { MappingRule } from "./mappings";

/** Status summary returned by GET /api/v1/status */
export interface ApiStatus {
  connections: number;
  collections: number;
  flows: number;
}

/** Connection record returned by the service API */
export interface ApiConnection {
  id: number;
  name: string;
  type: number;
  accountId: string | null;
  url: string | null;
  hasCredentials: boolean;
  includeRef: boolean;
  createdAt: string;
  updatedAt: string | null;
}

// --- Request body types ---

export interface CreateConnectionBody {
  name: string;
  type: number;
  accountId?: string | null;
  url?: string | null;
}

export interface UpdateConnectionBody {
  name?: string;
  includeRef?: boolean;
}

export interface CreateCollectionBody {
  displayName: string;
  name?: string;
  connectionId?: number | null;
  includeRef?: boolean;
}

export interface UpdateCollectionBody {
  displayName?: string;
  name?: string;
  includeRef?: boolean;
  schema?: CollectionSchema;
  refTargets?: Record<string, string[]> | null;
}

export interface CreateFlowBody {
  sourceId: number;
  targetId: number;
  includeRef?: boolean;
  filters?: Filter[];
  schema?: Record<string, SchemaValue>;
}

export interface UpdateFlowBody {
  filters?: Filter[] | null;
  mappings?: MappingRule[] | null;
  schema?: Record<string, SchemaValue> | null;
  includeRef?: boolean;
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
