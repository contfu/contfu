import { sql } from "drizzle-orm";
import {
  blob,
  foreignKey,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const userTable = sqliteTable("user", {
  id: integer().primaryKey({ autoIncrement: true }),
  email: text().unique().notNull(),
  name: text().notNull(),
  registrationToken: blob({ mode: "buffer" }).unique(),
  activeUntil: integer(),
  password: text(),
  oauthId: text().unique(),
  createdAt: integer()
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: integer(),
});

export type User = typeof userTable.$inferSelect;

export const sessionTable = sqliteTable("session", {
  id: blob({ mode: "buffer" }).primaryKey(),
  userId: integer()
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  expiresAt: integer().notNull(),
});

export type Session = typeof sessionTable.$inferSelect;

export const quotaTable = sqliteTable("quota", {
  id: integer()
    .primaryKey()
    .references(() => userTable.id, { onDelete: "cascade" }),
  sources: integer().notNull().default(0),
  maxSources: integer().notNull(),
  collections: integer().notNull().default(0),
  maxCollections: integer().notNull(),
  items: integer().notNull().default(0),
  maxItems: integer().notNull(),
  consumers: integer().notNull().default(0),
  maxConsumers: integer().notNull(),
});

export type Quota = typeof quotaTable.$inferSelect;

export const consumerTable = sqliteTable(
  "consumer",
  {
    userId: integer()
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    id: integer().notNull(),
    key: blob({ mode: "buffer" }).unique(),
    name: text().notNull(),
    createdAt: integer()
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.id] }),
  }),
);

export type Consumer = typeof consumerTable.$inferSelect;

export const sourceTable = sqliteTable(
  "source",
  {
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    id: integer().notNull(),
    name: text(),
    url: text(),
    credentials: blob({ mode: "buffer" }),
    type: integer().notNull(),
    createdAt: integer()
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: integer(),
  },
  (table) => ({ pk: primaryKey({ columns: [table.userId, table.id] }) }),
);

export type Source = typeof sourceTable.$inferSelect;

export const collectionTable = sqliteTable(
  "collection",
  {
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    sourceId: integer().notNull(),
    id: integer().notNull(),
    name: text().notNull(),
    ref: blob({ mode: "buffer" }),
    itemIds: blob({ mode: "buffer" }),
    createdAt: integer()
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: integer(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.id] }),
    sourceFk: foreignKey({
      columns: [table.userId, table.sourceId],
      foreignColumns: [sourceTable.userId, sourceTable.id],
    }).onDelete("cascade"),
  }),
);

export type Collection = typeof collectionTable.$inferSelect;

export const connectionTable = sqliteTable(
  "connection",
  {
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    consumerId: integer().notNull(),
    collectionId: integer().notNull(),
    lastItemChanged: integer(),
    lastConsistencyCheck: integer(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.userId, table.consumerId, table.collectionId],
    }),
    consumerFk: foreignKey({
      columns: [table.userId, table.consumerId],
      foreignColumns: [consumerTable.userId, consumerTable.id],
    }).onDelete("cascade"),
    collectionFk: foreignKey({
      columns: [table.userId, table.collectionId],
      foreignColumns: [collectionTable.userId, collectionTable.id],
    }).onDelete("cascade"),
  }),
);

export type Connection = typeof connectionTable.$inferSelect;

export const itemIdConflictResolutionTable = sqliteTable(
  "item_id_conflict_resolution",
  {
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    collectionId: integer().notNull(),
    sourceItemId: blob({ mode: "buffer" }).notNull(),
    id: integer().notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.userId, table.collectionId, table.sourceItemId],
    }),
    collectionFk: foreignKey({
      columns: [table.userId, table.collectionId],
      foreignColumns: [collectionTable.userId, collectionTable.id],
    }).onDelete("cascade"),
  }),
);

export type ItemIdConflictResolution =
  typeof itemIdConflictResolutionTable.$inferSelect;
