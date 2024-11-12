import { relations, sql } from "drizzle-orm";
import {
  blob,
  foreignKey,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { buffer } from "./custom-types";

export const userTable = sqliteTable("user", {
  /** The id of the user. */
  id: integer().primaryKey({ autoIncrement: true }),
  /** The email of the user. */
  email: text().unique().notNull(),
  /** The name of the user. */
  name: text().notNull(),
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

export type User = typeof userTable.$inferSelect;

export const sessionTable = sqliteTable("session", {
  /** The id of the session. */
  id: blob({ mode: "buffer" }).primaryKey(),
  /** The user id that the session belongs to. */
  userId: integer()
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  /** The time the session expires. */
  expiresAt: integer().notNull(),
});

export type Session = typeof sessionTable.$inferSelect;

export const quotaTable = sqliteTable("quota", {
  /** The user id that the quota belongs to. */
  id: integer()
    .primaryKey()
    .references(() => userTable.id, { onDelete: "cascade" }),
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
    credentials: buffer(),
    /** The type of the source. */
    type: integer().notNull(),
    /** The date the source was created. */
    createdAt: integer()
      .default(sql`(unixepoch())`)
      .notNull(),
    /** The date the source was updated. */
    updatedAt: integer(),
  },
  (table) => ({ pk: primaryKey({ columns: [table.userId, table.id] }) }),
);

export type Source = typeof sourceTable.$inferSelect;

export const collectionTable = sqliteTable(
  "collection",
  {
    /** The user which owns the collection. */
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    /** The source which the collection is connected to. */
    sourceId: integer().notNull(),
    /** The id which is unique within the user. */
    id: integer().notNull(),
    /** The name of the collection. */
    name: text().notNull(),
    /** The reference to the upstream collection within the source. */
    ref: buffer(),
    /** The item ids that have been received for this collection. **/
    itemIds: buffer(),
    /** The date the collection was created. */
    createdAt: integer()
      .default(sql`(unixepoch())`)
      .notNull(),
    /** The date the collection was updated. */
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

// Define relations
const collectionRelations = relations(collectionTable, ({ many, one }) => ({
  consumerCollectionConnections: many(connectionTable),
  source: one(sourceTable, {
    fields: [collectionTable.userId, collectionTable.sourceId],
    references: [sourceTable.userId, sourceTable.id],
  }),
}));

const consumerCollectionConnectionRelations = relations(
  connectionTable,
  ({ one }) => ({
    collection: one(collectionTable, {
      fields: [connectionTable.userId, connectionTable.collectionId],
      references: [collectionTable.userId, collectionTable.id],
    }),
  }),
);

// TODO: Move this to client
/** Mappings of ids from the source to the collection. This is used in case that there are collisions in the integer id space. */
export const itemIdConflictResolutionTable = sqliteTable(
  "item_id_conflict_resolution",
  {
    /** The user which owns the id mapping. */
    userId: integer()
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    /** The collection which the id mapping is connected to. */
    collectionId: integer().notNull(),
    /** The id which is unique within the source collection. */
    sourceItemId: buffer().notNull(),
    /** The 4 byte id which is unique within the collection. */
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

export const schema = {
  user: userTable,
  session: sessionTable,
  collection: collectionTable,
  consumer: consumerTable,
  source: sourceTable,
  connection: connectionTable,
  itemIdConflictResolution: itemIdConflictResolutionTable,
  collectionRelations,
  consumerCollectionConnectionRelations,
};
