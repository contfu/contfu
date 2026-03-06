/**
 * Domain types (DTOs) for the Contfu backend.
 *
 * These types are safe to expose to the SvelteKit app - they never contain
 * sensitive data like credentials, secrets, or API keys.
 *
 * Internal database types should be mapped to these before returning from
 * feature functions.
 */

import { SourceType } from "@contfu/core";
import type {
  ServiceCollection,
  ServiceIncidentWithDetails,
  ServiceInfluxDetails,
  ServiceInfluxWithDetails,
  ServiceSourceCollection,
  ServiceSourceCollectionSummary,
  ServiceSourceCollectionWithConnectionCount,
} from "@contfu/svc-core";
import type { Simplify } from "type-fest";

type DecodedIds<T, Ids extends keyof T & string> = Simplify<
  Omit<T, Ids> & {
    [K in Ids]: number;
  }
>;

// =============================================================================
// Integration Types
// =============================================================================

/** An OAuth integration without sensitive credentials */
export interface BackendIntegration {
  id: number;
  userId: number;
  providerId: string;
  label: string;
  accountId: string | null;
  hasCredentials: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

/** Input for creating a new integration */
export interface CreateIntegrationInput {
  providerId: string;
  label: string;
  accountId?: string | null;
  /** Raw credentials (will be encrypted by the feature) */
  credentials?: Buffer | null;
}

// =============================================================================
// Source Types
// =============================================================================

/** A source without sensitive credentials - safe to expose to the app */
export interface BackendSource {
  id: number;
  uid: string;
  userId: number;
  name: string;
  url: string | null;
  /** Whether refs are allowed to be transmitted from this source. */
  includeRef: boolean;
  /** Source type: 0 = Notion, 1 = Strapi, 2 = Web */
  type: number;
  /** Whether this source has credentials configured */
  hasCredentials: boolean;
  /** Whether this source has a webhook secret configured */
  hasWebhookSecret: boolean;
  /**
   * For Web sources (type 2), the authentication type:
   * 0 = None, 1 = Bearer Token, 2 = Basic Auth
   * Undefined for non-web sources.
   */
  webAuthType?: number;
  /** FK to integration (non-null means OAuth-sourced credentials) */
  integrationId: number | null;
  createdAt: Date;
  updatedAt: Date | null;
}

/** A source with its collection count */
export interface BackendSourceWithCollectionCount extends BackendSource {
  collectionCount: number;
}

/** Minimal source summary for lists/dropdowns */
export interface BackendSourceSummary {
  id: number;
  name: string | null;
  /** Source type: 0 = Notion, 1 = Strapi, 2 = Web */
  type: number;
}

// =============================================================================
// Collection Types (consumer-facing aggregation targets)
// =============================================================================

/** A collection with numeric IDs (internal) */
export type BackendCollection = Simplify<DecodedIds<ServiceCollection, "id"> & { userId: number }>;

// =============================================================================
// Source Collection Types (source-side collections)
// =============================================================================

/** A source collection with numeric IDs (internal) */
export type BackendSourceCollection = Simplify<
  DecodedIds<ServiceSourceCollection, "id" | "sourceId"> & { userId: number }
>;

/** A source collection with its connection count */
export type BackendSourceCollectionWithConnectionCount = Simplify<
  DecodedIds<ServiceSourceCollectionWithConnectionCount, "id" | "sourceId"> & { userId: number }
>;

/** Minimal source collection summary */
export type BackendSourceCollectionSummary = DecodedIds<ServiceSourceCollectionSummary, "id">;

// =============================================================================
// Influx Types
// =============================================================================

/** Influx with resolved source details, numeric IDs */
export type BackendInfluxWithDetails = DecodedIds<
  ServiceInfluxWithDetails,
  "id" | "sourceCollectionId" | "sourceId"
>;

/** Full influx details including collection info, numeric IDs */
export type BackendInfluxDetails = DecodedIds<
  ServiceInfluxDetails,
  "id" | "userId" | "collectionId" | "sourceCollectionId" | "sourceId"
>;

// =============================================================================
// Incident Types
// =============================================================================

/** Incident with resolved details, numeric IDs */
export type BackendIncidentWithDetails = DecodedIds<
  ServiceIncidentWithDetails,
  "id" | "influxId" | "collectionId" | "sourceCollectionId"
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
  createdAt: Date;
}

// =============================================================================
// Consumer Types
// =============================================================================

/** A consumer without the key buffer - safe to expose to the app */
export interface BackendConsumer {
  id: number;
  userId: number;
  name: string;
  /** Whether refs are allowed to be transmitted to this consumer. */
  includeRef: boolean;
  /** Whether this consumer has an API key configured (internal consumers don't) */
  hasKey: boolean;
  createdAt: Date;
}

/** A consumer with its connection count */
export interface BackendConsumerWithConnectionCount extends BackendConsumer {
  connectionCount: number;
}

/** Minimal consumer summary for lists/dropdowns */
export interface BackendConsumerSummary {
  id: number;
  name: string;
}

// =============================================================================
// ConsumerCollection Types
// =============================================================================

/** A consumer-collection join between a consumer and a collection */
export interface BackendConsumerCollection {
  userId: number;
  consumerId: number;
  collectionId: number;
  /** Whether refs are allowed on this specific connection. */
  includeRef: boolean;
  lastItemChanged: Date | null;
  lastConsistencyCheck: Date | null;
}

/** A consumer-collection join with resolved consumer and collection names */
export interface BackendConsumerCollectionWithDetails extends BackendConsumerCollection {
  consumerName: string;
  collectionName: string;
}

// =============================================================================
// Input Types (for create/update operations)
// =============================================================================

/** Input for creating a new source */
export interface CreateSourceInput {
  name: string;
  type: SourceType;
  url?: string | null;
  includeRef?: boolean;
  /** Raw credentials (will be encrypted by the feature) */
  credentials?: Buffer | null;
  /** Raw webhook secret (will be encrypted by the feature) */
  webhookSecret?: Buffer | null;
  /** FK to integration for OAuth-sourced credentials */
  integrationId?: number | null;
}

/** Input for updating a source */
export interface UpdateSourceInput {
  name?: string;
  url?: string | null;
  includeRef?: boolean;
  /** Raw credentials (will be encrypted by the feature) */
  credentials?: Buffer;
  /** Raw webhook secret (will be encrypted by the feature) */
  webhookSecret?: Buffer | null;
}

/** Input for creating a new source collection */
export interface CreateSourceCollectionInput {
  sourceId: number;
  name: string;
  ref?: Buffer | null;
  itemIds?: Buffer | null;
}

/** Input for updating a source collection */
export interface UpdateSourceCollectionInput {
  name?: string;
  ref?: Buffer | null;
  itemIds?: Buffer | null;
}

/** Input for creating a new consumer */
export interface CreateConsumerInput {
  name: string;
  includeRef?: boolean;
  /** If provided, the consumer will have an API key (external consumer) */
  key?: Buffer | null;
}

/** Input for updating a consumer */
export interface UpdateConsumerInput {
  name?: string;
  includeRef?: boolean;
  key?: Buffer | null;
}

/** Input for creating a new consumer-collection join */
export interface CreateConsumerCollectionInput {
  consumerId: number;
  collectionId: number;
  includeRef?: boolean;
  lastItemChanged?: Date | null;
  lastConsistencyCheck?: Date | null;
}

/** Input for updating a consumer-collection join */
export interface UpdateConsumerCollectionInput {
  includeRef?: boolean;
  lastItemChanged?: Date | null;
  lastConsistencyCheck?: Date | null;
}

/** User roles: 0 = user, 1 = admin */
export const UserRole = {
  USER: 0,
  ADMIN: 1,
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
