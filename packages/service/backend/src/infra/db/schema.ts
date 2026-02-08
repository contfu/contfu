import { sql } from "drizzle-orm";
import { blob, foreignKey, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { UserRole, type UserRole as UserRoleType } from "./constants";

// better-auth tables

export const userTable = sqliteTable("user", {
  id: integer().primaryKey(),
  name: text().notNull(),
  email: text().unique().notNull(),
  emailVerified: integer({ mode: "boolean" }).notNull().default(false),
  image: text(),
  role: integer().$type<UserRoleType>().notNull().default(UserRole.USER),
  approved: integer({ mode: "boolean" }).notNull().default(false),
  createdAt: integer({ mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: integer({ mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
});

export type User = typeof userTable.$inferSelect;

export const sessionTable = sqliteTable("session", {
  id: integer().primaryKey(),
  expiresAt: integer({ mode: "timestamp" }).notNull(),
  token: text().unique().notNull(),
  createdAt: integer({ mode: "timestamp" }).notNull(),
  updatedAt: integer({ mode: "timestamp" }).notNull(),
  ipAddress: text(),
  userAgent: text(),
  userId: integer()
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
});

export type Session = typeof sessionTable.$inferSelect;

export const accountTable = sqliteTable("account", {
  id: integer().primaryKey({ autoIncrement: true }),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: integer()
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: integer({ mode: "timestamp" }),
  refreshTokenExpiresAt: integer({ mode: "timestamp" }),
  scope: text(),
  password: text(),
  createdAt: integer({ mode: "timestamp" }).notNull(),
  updatedAt: integer({ mode: "timestamp" }).notNull(),
});

export type Account = typeof accountTable.$inferSelect;

export const verificationTable = sqliteTable("verification", {
  id: integer().primaryKey({ autoIncrement: true }),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: integer({ mode: "timestamp" }).notNull(),
  createdAt: integer({ mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer({ mode: "timestamp" }).$defaultFn(() => new Date()),
});

export type Verification = typeof verificationTable.$inferSelect;

// Application tables

export const quotaTable = sqliteTable("quota", {
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
  currentPeriodEnd: integer(),
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

export const consumerTable = sqliteTable(
  "consumer",
  {
    /** The user id that the consumer belongs to. */
    userId: integer()
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    /** The id of the consumer. */
    id: integer().notNull(),
    /** The key of the consumer. If null, the consumer is internal. */
    key: blob({ mode: "buffer" }).unique(),
    /** The name of the consumer. */
    name: text().notNull(),
    /** The time the consumer was created. */
    createdAt: integer()
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);

export type Consumer = typeof consumerTable.$inferSelect;

export const sourceTable = sqliteTable(
  "source",
  {
    /** The user which owns the source. */
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    /** The id which is unique within the user. */
    id: integer().notNull(),
    /** The name of the source. */
    name: text(),
    /** The url of the upstream source. Can be empty, if it is a centralized SaaS source. */
    url: text(),
    /** An api key or other credentials for the source. Used to fetch data from the upstream source. */
    credentials: blob({ mode: "buffer" }),
    /** The type of the source. */
    type: integer().notNull(),
    /** Webhook secret for validating incoming webhooks (optional). */
    webhookSecret: blob({ mode: "buffer" }),
    /**
     * Whether to include a ref field in Items linking back to the upstream SourceItem.
     * Default false (privacy-first). Can be overridden per SourceCollection→Collection link.
     */
    includeRef: integer({ mode: "boolean" }).notNull().default(false),
    /** The date the source was created. */
    createdAt: integer()
      .default(sql`(unixepoch())`)
      .notNull(),
    /** The date the source was updated. */
    updatedAt: integer(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.id] })],
);

export type Source = typeof sourceTable.$inferSelect;

export const sourceCollectionTable = sqliteTable(
  "source_collection",
  {
    /** The user which owns the source collection. */
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    /** The source which the source collection is connected to. */
    sourceId: integer().notNull(),
    /** The id which is unique within the user. */
    id: integer().notNull(),
    /** The name of the source collection (from upstream, may be fetched fresh). */
    name: text().notNull(),
    /**
     * User-provided display name for generic URL sources.
     * Takes precedence over `name` when set.
     */
    displayName: text(),
    /** The reference to the upstream collection within the source. */
    ref: blob({ mode: "buffer" }),
    /** The schema of the source collection (MessagePack serialized CollectionSchema). */
    schema: blob({ mode: "buffer" }),
    /** The item ids that have been received for this source collection. **/
    itemIds: blob({ mode: "buffer" }),
    /** The date the source collection was created. */
    createdAt: integer()
      .default(sql`(unixepoch())`)
      .notNull(),
    /** The date the source collection was updated. */
    updatedAt: integer(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.id] }),
    foreignKey({
      columns: [table.userId, table.sourceId],
      foreignColumns: [sourceTable.userId, sourceTable.id],
    }).onDelete("cascade"),
  ],
);

export type SourceCollection = typeof sourceCollectionTable.$inferSelect;

/**
 * A collection is an aggregation target that consumers subscribe to.
 * It can receive items from multiple source collections via mappings.
 */
export const collectionTable = sqliteTable(
  "collection",
  {
    /** The user which owns the collection. */
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    /** The id which is unique within the user. */
    id: integer().notNull(),
    /** The name of the collection (displayed to users). */
    name: text().notNull(),
    /** The date the collection was created. */
    createdAt: integer()
      .default(sql`(unixepoch())`)
      .notNull(),
    /** The date the collection was last updated. */
    updatedAt: integer(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.id] })],
);

export type Collection = typeof collectionTable.$inferSelect;

/**
 * An Influx defines data flowing from a SourceCollection into a Collection.
 * Includes optional filters and a schema snapshot for validation.
 */
export const influxTable = sqliteTable(
  "influx",
  {
    /** The user which owns the influx. */
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    /** The id which is unique within the user. */
    id: integer().notNull(),
    /** The target collection receiving items. */
    collectionId: integer().notNull(),
    /** The source collection providing items. */
    sourceCollectionId: integer().notNull(),
    /**
     * Schema snapshot at creation/last valid sync (MessagePack serialized).
     * Used for validating filters against schema changes.
     */
    schema: blob({ mode: "buffer" }),
    /**
     * Filters to apply to items from this source (MessagePack serialized).
     * Format: [{property: string, operator: string, value?: unknown}]
     * Empty/null means no filtering (all items pass through).
     */
    filters: blob({ mode: "buffer" }),
    /**
     * Override Source.includeRef for this specific link.
     * null = use Source default, true/false = override.
     */
    includeRef: integer({ mode: "boolean" }),
    /** The date the influx was created. */
    createdAt: integer()
      .default(sql`(unixepoch())`)
      .notNull(),
    /** The date the influx was last updated. */
    updatedAt: integer(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.id] }),
    foreignKey({
      columns: [table.userId, table.collectionId],
      foreignColumns: [collectionTable.userId, collectionTable.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId, table.sourceCollectionId],
      foreignColumns: [sourceCollectionTable.userId, sourceCollectionTable.id],
    }).onDelete("cascade"),
  ],
);

export type Influx = typeof influxTable.$inferSelect;

/** The connection of the consumer to the collection. */
export const connectionTable = sqliteTable(
  "connection",
  {
    /** The user which owns the collection and consumer. */
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    /** The consumer id. */
    consumerId: integer().notNull(),
    /** The collection which the consumer is connected to. */
    collectionId: integer().notNull(),
    /** The most recent item change that was received by the consumer. */
    lastItemChanged: integer(),
    /** The date the collection was last checked for deleted items. */
    lastConsistencyCheck: integer(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.consumerId, table.collectionId],
    }),
    foreignKey({
      columns: [table.userId, table.consumerId],
      foreignColumns: [consumerTable.userId, consumerTable.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId, table.collectionId],
      foreignColumns: [collectionTable.userId, collectionTable.id],
    }).onDelete("cascade"),
  ],
);

export type Connection = typeof connectionTable.$inferSelect;

export const itemIdConflictResolutionTable = sqliteTable(
  "item_id_conflict_resolution",
  {
    /** The user which owns the id mapping. */
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    /** The source collection which the id mapping is connected to. */
    sourceCollectionId: integer().notNull(),
    /** The id which is unique within the source collection. */
    sourceItemId: blob({ mode: "buffer" }).notNull(),
    /** The 4 byte id which is unique within the source collection. */
    id: integer().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.sourceCollectionId, table.sourceItemId],
    }),
    foreignKey({
      columns: [table.userId, table.sourceCollectionId],
      foreignColumns: [sourceCollectionTable.userId, sourceCollectionTable.id],
    }).onDelete("cascade"),
  ],
);

export type ItemIdConflictResolution = typeof itemIdConflictResolutionTable.$inferSelect;

// Webhook logging

export const webhookLogTable = sqliteTable(
  "webhook_log",
  {
    id: integer().primaryKey(),
    /** The user who owns the source. */
    userId: integer().notNull(),
    /** The source that received the webhook. */
    sourceId: integer().notNull(),
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
    timestamp: integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId, table.sourceId],
      foreignColumns: [sourceTable.userId, sourceTable.id],
    }).onDelete("cascade"),
  ],
);

export type WebhookLog = typeof webhookLogTable.$inferSelect;
export type NewWebhookLog = typeof webhookLogTable.$inferInsert;

// Incidents (sync failures due to schema incompatibility)

export const incidentTable = sqliteTable(
  "incident",
  {
    /** The user which owns the incident. */
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    /** The id which is unique within the user. */
    id: integer().notNull(),
    /** The influx that caused the incident. */
    influxId: integer().notNull(),
    /** The type of incident. */
    type: integer().notNull(), // IncidentType enum
    /** Human-readable description of the incident. */
    message: text().notNull(),
    /**
     * Details about the incident (MessagePack serialized).
     * For schema_incompatible: { oldSchema, newSchema, invalidFilters }
     */
    details: blob({ mode: "buffer" }),
    /** Whether the incident has been resolved. */
    resolved: integer({ mode: "boolean" }).notNull().default(false),
    /** When the incident was created. */
    createdAt: integer()
      .default(sql`(unixepoch())`)
      .notNull(),
    /** When the incident was resolved. */
    resolvedAt: integer(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.id] }),
    foreignKey({
      columns: [table.userId, table.influxId],
      foreignColumns: [influxTable.userId, influxTable.id],
    }).onDelete("cascade"),
  ],
);

export type Incident = typeof incidentTable.$inferSelect;
export type NewIncident = typeof incidentTable.$inferInsert;
