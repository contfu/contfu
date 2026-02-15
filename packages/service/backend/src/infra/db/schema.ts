import { sql } from "drizzle-orm";
import {
  boolean,
  bytea,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { UserRole, type UserRole as UserRoleType } from "./constants";

// better-auth tables

export const userTable = pgTable("user", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  email: text().unique().notNull(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  role: integer().$type<UserRoleType>().notNull().default(UserRole.USER),
  approved: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true, mode: "date" })
    .default(sql`now()`)
    .notNull(),
  updatedAt: timestamp({ withTimezone: true, mode: "date" })
    .default(sql`now()`)
    .notNull(),
});

export type User = typeof userTable.$inferSelect;

export const sessionTable = pgTable(
  "session",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    expiresAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    token: text().unique().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    userId: integer()
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export type Session = typeof sessionTable.$inferSelect;

export const accountTable = pgTable(
  "account",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: integer()
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true, mode: "date" }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true, mode: "date" }),
    scope: text(),
    password: text(),
    createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export type Account = typeof accountTable.$inferSelect;

export const verificationTable = pgTable("verification", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
  createdAt: timestamp({ withTimezone: true, mode: "date" }).$defaultFn(() => new Date()),
  updatedAt: timestamp({ withTimezone: true, mode: "date" }).$defaultFn(() => new Date()),
});

export type Verification = typeof verificationTable.$inferSelect;

// Application tables

export const quotaTable = pgTable("quota", {
  id: integer()
    .primaryKey()
    .references(() => userTable.id, { onDelete: "cascade" }),
  /** Polar customer ID */
  polarCustomerId: text(),
  /** Polar subscription ID */
  subscriptionId: text(),
  /** Subscription status (active, canceled, past_due, etc.) */
  subscriptionStatus: text(),
  /** Current billing period end timestamp */
  currentPeriodEnd: timestamp({ withTimezone: true, mode: "date" }),
  /** The number of sources. */
  sources: integer().notNull().default(0),
  /** The maximum number of sources. */
  maxSources: integer().notNull(),
  /** The number of collections. */
  collections: integer().notNull().default(0),
  /** The maximum number of collections. */
  maxCollections: integer().notNull(),
  /** The number of items. */
  items: integer().notNull().default(0),
  /** The maximum number of items. */
  maxItems: integer().notNull(),
  /** The number of consumers. */
  consumers: integer().notNull().default(0),
  /** The maximum number of consumers. */
  maxConsumers: integer().notNull(),
});

export type Quota = typeof quotaTable.$inferSelect;

export const consumerTable = pgTable(
  "consumer",
  {
    /** The globally unique id of the consumer. */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** The user id that the consumer belongs to. */
    userId: integer()
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    /** The key of the consumer. If null, the consumer is internal. */
    key: bytea().unique(),
    /** The name of the consumer. */
    name: text().notNull(),
    /** The time the consumer was created. */
    createdAt: timestamp({ withTimezone: true, mode: "date" })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [index("consumer_userId_idx").on(table.userId)],
);

export type Consumer = typeof consumerTable.$inferSelect;

export const sourceTable = pgTable(
  "source",
  {
    /** The globally unique id of the source. */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** The user which owns the source. */
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    /** Globally unique identifier for webhook URLs. */
    uid: uuid().unique().notNull(),
    /** The name of the source. */
    name: text(),
    /** The url of the upstream source. Can be empty, if it is a centralized SaaS source. */
    url: text(),
    /** An api key or other credentials for the source. Used to fetch data from the upstream source. */
    credentials: bytea(),
    /** The type of the source. */
    type: integer().notNull(),
    /** Webhook secret for validating incoming webhooks (optional). */
    webhookSecret: bytea(),
    /**
     * Whether to include a ref field in Items linking back to the upstream SourceItem.
     * Default false (privacy-first). Can be overridden per SourceCollection→Collection link.
     */
    includeRef: boolean().notNull().default(false),
    /** The date the source was created. */
    createdAt: timestamp({ withTimezone: true, mode: "date" })
      .default(sql`now()`)
      .notNull(),
    /** The date the source was updated. */
    updatedAt: timestamp({ withTimezone: true, mode: "date" }),
  },
  (table) => [index("source_userId_idx").on(table.userId)],
);

export type Source = typeof sourceTable.$inferSelect;

export const sourceCollectionTable = pgTable(
  "source_collection",
  {
    /** The globally unique id of the source collection. */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** The user which owns the source collection. */
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    /** The source which the source collection is connected to. */
    sourceId: integer()
      .notNull()
      .references(() => sourceTable.id, { onDelete: "cascade" }),
    /** The name of the source collection (from upstream, may be fetched fresh). */
    name: text().notNull(),
    /**
     * User-provided display name for generic URL sources.
     * Takes precedence over `name` when set.
     */
    displayName: text(),
    /** The reference to the upstream collection within the source. */
    ref: bytea(),
    /** The schema of the source collection (MessagePack serialized CollectionSchema). */
    schema: bytea(),
    /** The item ids that have been received for this source collection. **/
    itemIds: bytea(),
    /** The date the source collection was created. */
    createdAt: timestamp({ withTimezone: true, mode: "date" })
      .default(sql`now()`)
      .notNull(),
    /** The date the source collection was updated. */
    updatedAt: timestamp({ withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("source_collection_userId_idx").on(table.userId),
    index("source_collection_sourceId_idx").on(table.sourceId),
  ],
);

export type SourceCollection = typeof sourceCollectionTable.$inferSelect;

/**
 * A collection is an aggregation target that consumers subscribe to.
 * It can receive items from multiple source collections via mappings.
 */
export const collectionTable = pgTable(
  "collection",
  {
    /** The globally unique id of the collection. */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** The user which owns the collection. */
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    /** The name of the collection (displayed to users). */
    name: text().notNull(),
    /** The date the collection was created. */
    createdAt: timestamp({ withTimezone: true, mode: "date" })
      .default(sql`now()`)
      .notNull(),
    /** The date the collection was last updated. */
    updatedAt: timestamp({ withTimezone: true, mode: "date" }),
  },
  (table) => [index("collection_userId_idx").on(table.userId)],
);

export type Collection = typeof collectionTable.$inferSelect;

/**
 * An Influx defines data flowing from a SourceCollection into a Collection.
 * Includes optional filters and a schema snapshot for validation.
 */
export const influxTable = pgTable(
  "influx",
  {
    /** The globally unique id of the influx. */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** The user which owns the influx. */
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    /** The target collection receiving items. */
    collectionId: integer()
      .notNull()
      .references(() => collectionTable.id, { onDelete: "cascade" }),
    /** The source collection providing items. */
    sourceCollectionId: integer()
      .notNull()
      .references(() => sourceCollectionTable.id, { onDelete: "cascade" }),
    /**
     * Schema snapshot at creation/last valid sync (MessagePack serialized).
     * Used for validating filters against schema changes.
     */
    schema: bytea(),
    /**
     * Filters to apply to items from this source (MessagePack serialized).
     * Format: [{property: string, operator: string, value?: unknown}]
     * Empty/null means no filtering (all items pass through).
     */
    filters: bytea(),
    /**
     * Override Source.includeRef for this specific link.
     * null = use Source default, true/false = override.
     */
    includeRef: boolean(),
    /** The date the influx was created. */
    createdAt: timestamp({ withTimezone: true, mode: "date" })
      .default(sql`now()`)
      .notNull(),
    /** The date the influx was last updated. */
    updatedAt: timestamp({ withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("influx_userId_idx").on(table.userId),
    index("influx_collectionId_idx").on(table.collectionId),
    index("influx_sourceCollectionId_idx").on(table.sourceCollectionId),
  ],
);

export type Influx = typeof influxTable.$inferSelect;

/** The connection of the consumer to the collection. */
export const connectionTable = pgTable(
  "connection",
  {
    /** The user which owns the collection and consumer. */
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    /** The consumer id. */
    consumerId: integer()
      .notNull()
      .references(() => consumerTable.id, { onDelete: "cascade" }),
    /** The collection which the consumer is connected to. */
    collectionId: integer()
      .notNull()
      .references(() => collectionTable.id, { onDelete: "cascade" }),
    /** The most recent item change that was received by the consumer. */
    lastItemChanged: timestamp({ withTimezone: true, mode: "date" }),
    /** The date the collection was last checked for deleted items. */
    lastConsistencyCheck: timestamp({ withTimezone: true, mode: "date" }),
  },
  (table) => [
    primaryKey({ columns: [table.consumerId, table.collectionId] }),
    index("connection_userId_idx").on(table.userId),
    index("connection_consumerId_idx").on(table.consumerId),
    index("connection_collectionId_idx").on(table.collectionId),
  ],
);

export type Connection = typeof connectionTable.$inferSelect;

export const itemIdConflictResolutionTable = pgTable(
  "item_id_conflict_resolution",
  {
    /** The source collection which the id mapping is connected to. */
    sourceCollectionId: integer()
      .notNull()
      .references(() => sourceCollectionTable.id, { onDelete: "cascade" }),
    /** The id which is unique within the source collection. */
    sourceItemId: bytea().notNull(),
    /** The 4 byte id which is unique within the source collection. */
    id: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sourceCollectionId, table.sourceItemId] }),
    index("item_id_conflict_sourceCollectionId_idx").on(table.sourceCollectionId),
  ],
);

export type ItemIdConflictResolution = typeof itemIdConflictResolutionTable.$inferSelect;

// Webhook logging

export const webhookLogTable = pgTable(
  "webhook_log",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** The source that received the webhook. */
    sourceId: integer()
      .notNull()
      .references(() => sourceTable.id, { onDelete: "cascade" }),
    /** The webhook event type (e.g., entry.create, entry.update). */
    event: text().notNull(),
    /** The content type/model affected. */
    model: text(),
    /** Status of the webhook processing. */
    status: text().notNull(), // 'success' | 'error' | 'unauthorized'
    /** Error message if processing failed. */
    errorMessage: text(),
    /** Number of items broadcast to consumers. */
    itemsBroadcast: integer().notNull().default(0),
    /** When the webhook was received. */
    timestamp: timestamp({ withTimezone: true, mode: "date" })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [index("webhook_log_sourceId_idx").on(table.sourceId)],
);

export type WebhookLog = typeof webhookLogTable.$inferSelect;
export type NewWebhookLog = typeof webhookLogTable.$inferInsert;

// Incidents (sync failures due to schema incompatibility)

export const incidentTable = pgTable(
  "incident",
  {
    /** The globally unique id of the incident. */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** The user which owns the incident. */
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    /** The influx that caused the incident. */
    influxId: integer()
      .notNull()
      .references(() => influxTable.id, { onDelete: "cascade" }),
    /** The type of incident. */
    type: integer().notNull(), // IncidentType enum
    /** Human-readable description of the incident. */
    message: text().notNull(),
    /**
     * Details about the incident (MessagePack serialized).
     * For schema_incompatible: { oldSchema, newSchema, invalidFilters }
     */
    details: bytea(),
    /** Whether the incident has been resolved. */
    resolved: boolean().notNull().default(false),
    /** When the incident was created. */
    createdAt: timestamp({ withTimezone: true, mode: "date" })
      .default(sql`now()`)
      .notNull(),
    /** When the incident was resolved. */
    resolvedAt: timestamp({ withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("incident_userId_idx").on(table.userId),
    index("incident_influxId_idx").on(table.influxId),
  ],
);

export type Incident = typeof incidentTable.$inferSelect;
export type NewIncident = typeof incidentTable.$inferInsert;

// Sync job queue (SKIP LOCKED pattern)

export const syncJobTable = pgTable(
  "sync_job",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** The source collection to sync. */
    sourceCollectionId: integer()
      .notNull()
      .references(() => sourceCollectionTable.id, { onDelete: "cascade" }),
    /** Job status: pending | running | completed | failed */
    status: text().notNull().default("pending"),
    /** When the job is scheduled to run. */
    scheduledAt: timestamp({ withTimezone: true, mode: "date" })
      .default(sql`now()`)
      .notNull(),
    /** When the job started running. */
    startedAt: timestamp({ withTimezone: true, mode: "date" }),
    /** When the job completed or permanently failed. */
    completedAt: timestamp({ withTimezone: true, mode: "date" }),
    /** Error message from the last attempt. */
    errorMessage: text(),
    /** Number of attempts made. */
    attempts: integer().notNull().default(0),
    /** Maximum number of attempts before permanent failure. */
    maxAttempts: integer().notNull().default(3),
    /** The worker ID that claimed this job. */
    workerId: text(),
  },
  (table) => [
    index("sync_job_sourceCollectionId_idx").on(table.sourceCollectionId),
    index("sync_job_queue_idx").on(table.status, table.scheduledAt),
    index("sync_job_status_idx").on(table.status, table.startedAt),
  ],
);

export type SyncJob = typeof syncJobTable.$inferSelect;
export type NewSyncJob = typeof syncJobTable.$inferInsert;

// System settings

export const settingTable = pgTable("setting", {
  key: text().primaryKey(),
  value: bytea(),
  updatedAt: timestamp({ withTimezone: true, mode: "date" })
    .default(sql`now()`)
    .notNull(),
});

export type Setting = typeof settingTable.$inferSelect;
