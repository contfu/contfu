import { relations, sql } from "drizzle-orm";
import {
  foreignKey,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { account, consumer } from "../../access/db/access-schema";
import { buffer } from "../../core/db/custom-types";

export const source = sqliteTable(
  "source",
  {
    /** The account which owns the source. */
    accountId: integer()
      .references(() => account.id, { onDelete: "cascade" })
      .notNull(),
    /** The id which is unique within the account. */
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
  (table) => ({ pk: primaryKey({ columns: [table.accountId, table.id] }) })
);

export type DbSource = typeof source.$inferSelect;

export const collection = sqliteTable(
  "collection",
  {
    /** The account which owns the collection. */
    accountId: integer()
      .references(() => account.id, { onDelete: "cascade" })
      .notNull(),
    /** The source which the collection is connected to. */
    sourceId: integer().notNull(),
    /** The id which is unique within the account. */
    id: integer().notNull(),
    /** The name of the collection. */
    name: text().notNull(),
    /** The reference to the upstream collection within the source. */
    ref: buffer(),
    /**
     * The item ids that are expected to have been received for this collection.
     * The ids are 4 bytes long.
     **/
    itemIds: buffer(),
    /** The date the collection was created. */
    createdAt: integer()
      .default(sql`(unixepoch())`)
      .notNull(),
    /** The date the collection was updated. */
    updatedAt: integer(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.accountId, table.id] }),
    sourceFk: foreignKey({
      columns: [table.accountId, table.sourceId],
      foreignColumns: [source.accountId, source.id],
    }).onDelete("cascade"),
  })
);

export type DbCollection = typeof collection.$inferSelect;

/** The connection of the consumer to the collection. */
export const connection = sqliteTable(
  "connection",
  {
    /** The account which owns the collection and consumer. */
    accountId: integer()
      .references(() => account.id, { onDelete: "cascade" })
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
      columns: [table.accountId, table.consumerId, table.collectionId],
    }),
    consumerFk: foreignKey({
      columns: [table.accountId, table.consumerId],
      foreignColumns: [consumer.accountId, consumer.id],
    }).onDelete("cascade"),
    collectionFk: foreignKey({
      columns: [table.accountId, table.collectionId],
      foreignColumns: [collection.accountId, collection.id],
    }).onDelete("cascade"),
  })
);

export type DbConnection = typeof connection.$inferSelect;

// Define relations
export const collectionRelations = relations(collection, ({ many, one }) => ({
  consumerCollectionConnections: many(connection),
  source: one(source, {
    fields: [collection.accountId, collection.sourceId],
    references: [source.accountId, source.id],
  }),
}));

export const consumerCollectionConnectionRelations = relations(
  connection,
  ({ one }) => ({
    collection: one(collection, {
      fields: [connection.accountId, connection.collectionId],
      references: [collection.accountId, collection.id],
    }),
  })
);

/** Mappings of ids from the source to the collection. This is used in case that there are collisions in the integer id space. */
export const itemIdConflictResolution = sqliteTable(
  "item_id_conflict_resolution",
  {
    /** The account which owns the id mapping. */
    accountId: integer()
      .references(() => account.id, { onDelete: "cascade" })
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
      columns: [table.accountId, table.collectionId, table.sourceItemId],
    }),
    collectionFk: foreignKey({
      columns: [table.accountId, table.collectionId],
      foreignColumns: [collection.accountId, collection.id],
    }).onDelete("cascade"),
  })
);

export type ItemIdConflictResolution =
  typeof itemIdConflictResolution.$inferSelect;
