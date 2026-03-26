import { ConnectionType } from "@contfu/core";
import { pack } from "msgpackr";
import { sql } from "drizzle-orm";
import {
  boolean,
  bytea,
  index,
  integer,
  pgPolicy,
  pgRole,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { UserRole, type UserRole as UserRoleType } from "../../domain/types";
import { PlanTier, type PlanTier as PlanTierType } from "../polar/products";

export const appUserRole = pgRole("app_user");
export const serviceRole = pgRole("service_role");

export const currentUserIdSql = sql`current_setting('app.current_user_id', true)::integer`;

// better-auth tables

export const userTable = pgTable("user", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  email: text().unique().notNull(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  role: integer().$type<UserRoleType>().notNull().default(UserRole.USER),
  /** Admin-assigned base plan tier (fallback when no paid subscription is active) */
  basePlan: integer().$type<PlanTierType>().notNull().default(PlanTier.FREE),
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

export const apikeyTable = pgTable("apikey", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  configId: text(),
  name: text(),
  start: text(),
  prefix: text(),
  key: text().notNull(),
  userId: integer().notNull(),
  refillInterval: integer(),
  refillAmount: integer(),
  lastRefillAt: timestamp({ precision: 6, withTimezone: true }),
  enabled: boolean().notNull(),
  rateLimitEnabled: boolean().notNull(),
  rateLimitTimeWindow: integer(),
  rateLimitMax: integer(),
  requestCount: integer().notNull(),
  remaining: integer(),
  lastRequest: timestamp({ precision: 6, withTimezone: true }),
  expiresAt: timestamp({ precision: 6, withTimezone: true }),
  createdAt: timestamp({ precision: 6, withTimezone: true }).notNull(),
  updatedAt: timestamp({ precision: 6, withTimezone: true }).notNull(),
  permissions: text(),
  metadata: text(),
});

export type ApiKey = typeof apikeyTable.$inferSelect;

// Application tables

export const connectionTable = pgTable.withRLS(
  "connection",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer()
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    /** Connection type (Notion, Strapi, Web, Client, etc.) */
    type: integer().$type<ConnectionType>().notNull(),
    /** User-facing name */
    name: text().notNull(),
    /** Provider-side account/workspace ID for dedup */
    accountId: text(),
    /** Encrypted credentials (OAuth tokens, API keys, client API keys) */
    credentials: bytea(),
    /** URL for non-well-known services (e.g. Strapi instance URL) */
    url: text(),
    /** Globally unique identifier for webhook URLs. */
    uid: uuid().unique(),
    /** Webhook secret for validating incoming webhooks (optional). */
    webhookSecret: bytea(),
    /** Whether to include ref fields linking back to upstream items. */
    includeRef: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true, mode: "date" })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("connection_userId_idx").on(table.userId),
    pgPolicy("connection_user_isolation", {
      for: "all",
      to: appUserRole,
      using: sql`${table.userId} = ${currentUserIdSql}`,
      withCheck: sql`${table.userId} = ${currentUserIdSql}`,
    }),
  ],
);

export type Connection = typeof connectionTable.$inferSelect;

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
  /** The number of connections. */
  connections: integer().notNull().default(0),
  /** The maximum number of connections. */
  maxConnections: integer().notNull(),
  /** The number of collections. */
  collections: integer().notNull().default(0),
  /** The maximum number of collections. */
  maxCollections: integer().notNull(),
  /** The number of flows. */
  flows: integer().notNull().default(0),
  /** The maximum number of flows. */
  maxFlows: integer().notNull(),
  /** The number of items. */
  items: integer().notNull().default(0),
  /** The maximum number of items. */
  maxItems: integer().notNull(),
});

export type Quota = typeof quotaTable.$inferSelect;

/**
 * A collection is an aggregation target that can optionally be bound to a connection.
 * Virtual collections (connectionId=null) have no external system backing.
 */
export const collectionTable = pgTable.withRLS(
  "collection",
  {
    /** The globally unique id of the collection. */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** The user which owns the collection. */
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    /** FK to connection (nullable — null means virtual collection). */
    connectionId: integer().references(() => connectionTable.id, { onDelete: "cascade" }),
    /** Human-readable display name (e.g. "Blog Posts"). */
    displayName: text().notNull(),
    /** The camelCase identifier name of the collection (e.g. "blogPosts"). */
    name: text().notNull(),
    /** The reference to the upstream collection within the connection (e.g. Notion DB UUID). */
    ref: bytea(),
    /** The target schema of the collection (MessagePack serialized CollectionSchema). */
    schema: bytea()
      .notNull()
      .$default(() => pack({})),
    /** Ref target constraints per property (MessagePack serialized RefTargets). */
    refTargets: bytea(),
    /** Whether refs may be transmitted for this collection. */
    includeRef: boolean().notNull().default(true),
    /** Optional visual icon for the collection (MessagePack serialized CollectionIcon). */
    icon: bytea(),
    /** Notion property ID → internal camelCase name (MessagePack Record<notionId, name>). */
    notionPropertyIds: bytea(),
    /** The date the collection was created. */
    createdAt: timestamp({ withTimezone: true, mode: "date" })
      .default(sql`now()`)
      .notNull(),
    /** The date the collection was last updated. */
    updatedAt: timestamp({ withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("collection_userId_idx").on(table.userId),
    index("collection_connectionId_idx").on(table.connectionId),
    pgPolicy("collection_user_isolation", {
      for: "all",
      to: appUserRole,
      using: sql`${table.userId} = ${currentUserIdSql}`,
      withCheck: sql`${table.userId} = ${currentUserIdSql}`,
    }),
  ],
);

export type Collection = typeof collectionTable.$inferSelect;

/**
 * A flow defines data movement between two collections, forming a DAG.
 * Includes optional filters, mappings, and a schema snapshot.
 */
export const flowTable = pgTable.withRLS(
  "flow",
  {
    /** The globally unique id of the flow. */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** The user which owns the flow. */
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    /** The source collection providing items. */
    sourceId: integer()
      .notNull()
      .references(() => collectionTable.id, { onDelete: "cascade" }),
    /** The target collection receiving items. */
    targetId: integer()
      .notNull()
      .references(() => collectionTable.id, { onDelete: "cascade" }),
    /**
     * Schema snapshot at creation/last valid sync (MessagePack serialized).
     */
    schema: bytea(),
    /**
     * Mapping rules from source to target properties (MessagePack serialized MappingRule[]).
     */
    mappings: bytea(),
    /**
     * Filters to apply to items from this source (MessagePack serialized).
     */
    filters: bytea(),
    /** Whether refs may be transmitted for this specific flow. */
    includeRef: boolean().notNull().default(true),
    /** The date the flow was created. */
    createdAt: timestamp({ withTimezone: true, mode: "date" })
      .default(sql`now()`)
      .notNull(),
    /** The date the flow was last updated. */
    updatedAt: timestamp({ withTimezone: true, mode: "date" }),
  },
  (table) => [
    unique("flow_source_target_unique").on(table.sourceId, table.targetId),
    index("flow_userId_idx").on(table.userId),
    index("flow_sourceId_idx").on(table.sourceId),
    index("flow_targetId_idx").on(table.targetId),
    pgPolicy("flow_user_isolation", {
      for: "all",
      to: appUserRole,
      using: sql`${table.userId} = ${currentUserIdSql}`,
      withCheck: sql`${table.userId} = ${currentUserIdSql}`,
    }),
  ],
);

export type Flow = typeof flowTable.$inferSelect;

export const itemIdConflictResolutionTable = pgTable(
  "item_id_conflict_resolution",
  {
    /** The collection which the id mapping is connected to. */
    collectionId: integer()
      .notNull()
      .references(() => collectionTable.id, { onDelete: "cascade" }),
    /** The id which is unique within the collection. */
    sourceItemId: bytea().notNull(),
    /** The 4 byte id which is unique within the collection. */
    id: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.sourceItemId] }),
    index("item_id_conflict_collectionId_idx").on(table.collectionId),
  ],
);

export type ItemIdConflictResolution = typeof itemIdConflictResolutionTable.$inferSelect;

// Webhook logging

export const webhookLogTable = pgTable.withRLS(
  "webhook_log",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** The connection that received the webhook. */
    connectionId: integer()
      .notNull()
      .references(() => connectionTable.id, { onDelete: "cascade" }),
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
  (table) => [
    index("webhook_log_connectionId_idx").on(table.connectionId),
    pgPolicy("webhook_log_user_isolation", {
      for: "all",
      to: appUserRole,
      using: sql`
        exists (
          select 1
          from "connection" c
          where c.id = ${table.connectionId}
            and c."userId" = ${currentUserIdSql}
        )
      `,
      withCheck: sql`
        exists (
          select 1
          from "connection" c
          where c.id = ${table.connectionId}
            and c."userId" = ${currentUserIdSql}
        )
      `,
    }),
  ],
);

export type WebhookLog = typeof webhookLogTable.$inferSelect;
export type NewWebhookLog = typeof webhookLogTable.$inferInsert;

// Incidents (sync failures due to schema incompatibility)

export const incidentTable = pgTable.withRLS(
  "incident",
  {
    /** The globally unique id of the incident. */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** The user which owns the incident. */
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    /** The flow that caused the incident. */
    flowId: integer()
      .notNull()
      .references(() => flowTable.id, { onDelete: "cascade" }),
    /** The type of incident. */
    type: integer().notNull(), // IncidentType enum
    /** Human-readable description of the incident. */
    message: text().notNull(),
    /**
     * Details about the incident (MessagePack serialized).
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
    index("incident_flowId_idx").on(table.flowId),
    pgPolicy("incident_user_isolation", {
      for: "all",
      to: appUserRole,
      using: sql`${table.userId} = ${currentUserIdSql}`,
      withCheck: sql`${table.userId} = ${currentUserIdSql}`,
    }),
  ],
);

export type Incident = typeof incidentTable.$inferSelect;
export type NewIncident = typeof incidentTable.$inferInsert;

// Sync job queue (SKIP LOCKED pattern)

export const syncJobTable = pgTable.withRLS(
  "sync_job",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** The collection to sync. */
    collectionId: integer()
      .notNull()
      .references(() => collectionTable.id, { onDelete: "cascade" }),
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
    index("sync_job_collectionId_idx").on(table.collectionId),
    index("sync_job_queue_idx").on(table.status, table.scheduledAt),
    index("sync_job_status_idx").on(table.status, table.startedAt),
    pgPolicy("sync_job_user_isolation", {
      for: "all",
      to: appUserRole,
      using: sql`
        exists (
          select 1
          from "collection" c
          where c.id = ${table.collectionId}
            and c."userId" = ${currentUserIdSql}
        )
      `,
      withCheck: sql`
        exists (
          select 1
          from "collection" c
          where c.id = ${table.collectionId}
            and c."userId" = ${currentUserIdSql}
        )
      `,
    }),
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

// Msgpackr data migrations tracking

export const msgpackrMigrationTable = pgTable(
  "msgpackr_migration",
  {
    tablename: text().notNull(),
    columnname: text().notNull(),
    version: integer().notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.tablename, table.columnname] })],
);

export type MsgpackrMigration = typeof msgpackrMigrationTable.$inferSelect;
