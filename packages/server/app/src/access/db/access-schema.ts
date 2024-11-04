import { sql } from "drizzle-orm";
import {
  blob,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { buffer } from "../../core/db/custom-types";

export const user = sqliteTable("user", {
  /** The id of the user. */
  id: integer().primaryKey({ autoIncrement: true }),
  /** The email of the user. */
  email: text().unique().notNull(),
  /**
   * The time the user is active. If it is in the past, the user is inactive.
   * If it is null, the user is active forever.
   */
  activeUntil: integer(),
  /** The password hash of the user. */
  password: text(),
  /** The time the user was created. */
  createdAt: integer()
    .default(sql`(unixepoch())`)
    .notNull(),
  /** The time the user was updated. */
  updatedAt: integer(),
});

export type DbUser = typeof user.$inferSelect;

export const session = sqliteTable("session", {
  /** The id of the session. */
  id: blob().primaryKey(),
  /** The user id that the session belongs to. */
  userId: integer()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  /** The time the session expires. */
  expiresAt: integer().notNull(),
});

export type DbSession = typeof session.$inferSelect;

export const quota = sqliteTable("quota", {
  /** The user id that the quota belongs to. */
  id: integer()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** The number of sources. */
  sources: integer().notNull(),
  /** The maximum number of sources. */
  maxSources: integer().notNull(),
  /** The number of collections. */
  collections: integer().notNull(),
  /** The maximum number of collections. */
  maxCollections: integer().notNull(),
  /** The number of items. */
  items: integer().notNull(),
  /** The maximum number of items. */
  maxItems: integer().notNull(),
  /** The number of clients. */
  clients: integer().notNull(),
  /** The maximum number of clients. */
  maxClients: integer().notNull(),
});

export type DbQuota = typeof quota.$inferSelect;

export const consumer = sqliteTable(
  "consumer",
  {
    /** The user id that the consumer belongs to. */
    userId: integer()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The id of the consumer. */
    id: integer().notNull(),
    /** The key of the consumer. If null, the consumer is internal. */
    key: buffer().unique(),
    /** The name of the consumer. */
    name: text().notNull(),
    /** The time the consumer was created. */
    createdAt: integer()
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.id] }),
  }),
);

export type DbConsumer = typeof consumer.$inferSelect;
