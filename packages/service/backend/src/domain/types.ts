/**
 * Domain types (DTOs) for the Contfu backend.
 *
 * These types are safe to expose to the SvelteKit app - they never contain
 * sensitive data like credentials, secrets, or API keys.
 *
 * Internal database types should be mapped to these before returning from
 * feature functions.
 */

// =============================================================================
// Source Types
// =============================================================================

/** A source without sensitive credentials - safe to expose to the app */
export interface BackendSource {
  id: number;
  uid: string;
  userId: number;
  name: string | null;
  url: string | null;
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
// Collection Types
// =============================================================================

/** A collection without internal buffer fields - safe to expose to the app */
export interface BackendCollection {
  id: number;
  userId: number;
  sourceId: number;
  name: string;
  /** Whether this collection has a ref configured */
  hasRef: boolean;
  /** The ref as a string (e.g., Notion database ID) - safe to expose */
  refString: string | null;
  /** Number of item IDs stored (derived from itemIds buffer) */
  itemCount: number;
  createdAt: Date;
  updatedAt: Date | null;
}

/** A collection with its connection count */
export interface BackendCollectionWithConnectionCount extends BackendCollection {
  connectionCount: number;
}

/** Minimal collection summary for lists/dropdowns */
export interface BackendCollectionSummary {
  id: number;
  name: string;
  /** The ref as a string (e.g., Notion database ID) - useful for checking duplicates */
  refString: string | null;
  connectionCount: number;
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
// Connection Types
// =============================================================================

/** A connection between a consumer and a collection */
export interface BackendConnection {
  userId: number;
  consumerId: number;
  collectionId: number;
  lastItemChanged: Date | null;
  lastConsistencyCheck: Date | null;
}

/** A connection with resolved consumer and collection names */
export interface BackendConnectionWithDetails extends BackendConnection {
  consumerName: string;
  collectionName: string;
}

// =============================================================================
// Input Types (for create/update operations)
// =============================================================================

/** Input for creating a new source */
export interface CreateSourceInput {
  name: string;
  /** Source type: 0 = Notion, 1 = Strapi, 2 = Web */
  type: number;
  url?: string | null;
  /** Raw credentials (will be encrypted by the feature) */
  credentials?: Buffer | null;
  /** Raw webhook secret (will be encrypted by the feature) */
  webhookSecret?: Buffer | null;
}

/** Input for updating a source */
export interface UpdateSourceInput {
  name?: string;
  url?: string | null;
  /** Raw credentials (will be encrypted by the feature) */
  credentials?: Buffer;
  /** Raw webhook secret (will be encrypted by the feature) */
  webhookSecret?: Buffer | null;
}

/** Input for creating a new collection */
export interface CreateCollectionInput {
  sourceId: number;
  name: string;
  ref?: Buffer | null;
  itemIds?: Buffer | null;
}

/** Input for updating a collection */
export interface UpdateCollectionInput {
  name?: string;
  ref?: Buffer | null;
  itemIds?: Buffer | null;
}

/** Input for creating a new consumer */
export interface CreateConsumerInput {
  name: string;
  /** If provided, the consumer will have an API key (external consumer) */
  key?: Buffer | null;
}

/** Input for updating a consumer */
export interface UpdateConsumerInput {
  name?: string;
  key?: Buffer | null;
}

/** Input for creating a new connection */
export interface CreateConnectionInput {
  consumerId: number;
  collectionId: number;
  lastItemChanged?: Date | null;
  lastConsistencyCheck?: Date | null;
}

/** Input for updating a connection */
export interface UpdateConnectionInput {
  lastItemChanged?: Date | null;
  lastConsistencyCheck?: Date | null;
}
