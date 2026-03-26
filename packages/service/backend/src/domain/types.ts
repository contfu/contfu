/**
 * Domain types (DTOs) for the Contfu backend.
 *
 * These types are safe to expose to the SvelteKit app - they never contain
 * sensitive data like credentials, secrets, or API keys.
 *
 * Internal database types should be mapped to these before returning from
 * feature functions.
 */

import type { CollectionIcon, CollectionSchema, ConnectionType } from "@contfu/core";
import type {
  ServiceCollection,
  ServiceFlow,
  ServiceFlowWithDetails,
  ServiceIncidentWithDetails,
} from "@contfu/svc-core";
import type { PlanTier } from "../infra/polar/products";
import type { Simplify } from "type-fest";

type DecodedIds<T, Ids extends keyof T & string> = Simplify<
  Omit<T, Ids> & {
    [K in Ids]: number;
  }
>;

// =============================================================================
// Connection Types
// =============================================================================

/** A connection without sensitive credentials */
export interface BackendConnection {
  id: number;
  userId: number;
  type: ConnectionType;
  name: string;
  accountId: string | null;
  url: string | null;
  uid: string | null;
  hasCredentials: boolean;
  hasWebhookSecret: boolean;
  includeRef: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

/** Input for creating a new connection */
export interface CreateConnectionInput {
  type: ConnectionType;
  name: string;
  accountId?: string | null;
  url?: string | null;
  uid?: string | null;
  includeRef?: boolean;
  /** Raw credentials (will be encrypted by the feature) */
  credentials?: Buffer | null;
  /** Raw webhook secret (will be encrypted by the feature) */
  webhookSecret?: Buffer | null;
}

/** Input for updating a connection */
export interface UpdateConnectionInput {
  name?: string;
  includeRef?: boolean;
  /** Raw credentials (will be encrypted by the feature unless skipCredentialsEncryption is true) */
  credentials?: Buffer | null;
  /** Raw webhook secret (will be encrypted by the feature) */
  webhookSecret?: Buffer | null;
  /** When true, credentials are stored as-is without encryption (used for CLIENT API keys). */
  skipCredentialsEncryption?: boolean;
}

// =============================================================================
// Collection Types
// =============================================================================

/** A collection with numeric IDs (internal) */
export type BackendCollection = Simplify<
  Omit<DecodedIds<ServiceCollection, "id">, "connectionId"> & {
    userId: number;
    connectionId: number | null;
    connectionName: string | null;
    connectionType: number | null;
  }
>;

/** Input for creating a new collection */
export interface CreateCollectionInput {
  displayName: string;
  name?: string;
  connectionId?: number | null;
  ref?: Buffer | null;
  includeRef?: boolean;
  icon?: CollectionIcon | null;
}

/** Input for updating a collection */
export interface UpdateCollectionInput {
  displayName?: string;
  name?: string;
  includeRef?: boolean;
  schema?: CollectionSchema;
  refTargets?: Record<string, string[]> | null;
  icon?: CollectionIcon | null;
}

// =============================================================================
// Flow Types
// =============================================================================

/** A flow with numeric IDs (internal) */
export type BackendFlow = DecodedIds<ServiceFlow, "id" | "sourceId" | "targetId">;

/** A flow with resolved source/target details */
export type BackendFlowWithDetails = DecodedIds<
  ServiceFlowWithDetails,
  "id" | "sourceId" | "targetId"
>;

/** Input for creating a new flow */
export interface CreateFlowInput {
  sourceId: number;
  targetId: number;
  filters?: Buffer | null;
  mappings?: Buffer | null;
  schema?: Buffer | null;
  includeRef?: boolean;
}

/** Input for updating a flow */
export interface UpdateFlowInput {
  filters?: Buffer | null;
  mappings?: Buffer | null;
  schema?: Buffer | null;
  includeRef?: boolean;
}

// =============================================================================
// Incident Types
// =============================================================================

/** Incident with resolved details, numeric IDs */
export type BackendIncidentWithDetails = DecodedIds<
  ServiceIncidentWithDetails,
  "id" | "flowId" | "sourceCollectionId" | "targetCollectionId"
>;

// =============================================================================
// User Types
// =============================================================================

/**
 * User summary for admin views.
 * Uses numeric ID since it's only exposed to admins.
 */
export interface BackendUserSummary {
  id: number;
  name: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  approved: boolean;
  basePlan: PlanTier;
  createdAt: Date;
}

// =============================================================================
// Input Types (for create/update operations)
// =============================================================================

/** User roles: 0 = user, 1 = admin */
export const UserRole = {
  USER: 0,
  ADMIN: 1,
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
