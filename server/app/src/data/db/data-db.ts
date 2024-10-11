import { relations } from "drizzle-orm";
import {
  foreignKey,
  integer,
  jsonb,
  pgEnum,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { account, client } from "../../access/db/access-db";
import { bytea } from "../../core/db/db-types";

export const dataSchema = pgSchema("data");

export const sourceType = pgEnum("source_type", ["notion"]);

export const source = dataSchema.table(
  "source",
  {
    /** The account which owns the source. */
    accountId: integer()
      .references(() => account.id, { onDelete: "cascade" })
      .notNull(),
    /** The id which is unique within the account. */
    id: smallint().notNull(),
    /** An api key for the source. Not necessary for all source types. */
    key: bytea(),
    /** The name of the source. */
    name: text().notNull(),
    /** The options for the source. Can contain source specific options. */
    opts: jsonb(),
    /** The type of the source. */
    type: sourceType().notNull(),
    /** The date the source was created. */
    createdAt: timestamp().defaultNow().notNull(),
    /** The date the source was updated. */
    updatedAt: timestamp(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.accountId, table.id] }),
    uniqueKeyWithType: unique().on(table.key, table.type),
  })
);

export type Source = typeof source.$inferSelect;

export const collection = dataSchema.table(
  "collection",
  {
    /** The account which owns the collection. */
    accountId: integer()
      .references(() => account.id, { onDelete: "cascade" })
      .notNull(),
    /** The source which the collection is connected to. */
    sourceId: smallint().notNull(),
    /** The id which is unique within the account. */
    id: smallint().notNull(),
    /** The name of the collection. */
    name: text().notNull(),
    /** The options for the collection. Can contain collection specific options. */
    opts: jsonb(),
    /** The date the collection was created. */
    createdAt: timestamp().defaultNow().notNull(),
    /** The date the collection was updated. */
    updatedAt: timestamp(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.accountId, table.id] }),
    sourceFk: foreignKey({
      columns: [table.accountId, table.sourceId],
      foreignColumns: [source.accountId, source.id],
    }).onDelete("cascade"),
  })
);

export type Collection = typeof collection.$inferSelect;

/** The connection of the client to the collection. */
export const clientCollectionConnection = dataSchema.table(
  "client_collection_connection",
  {
    /** The account which owns the collection and client. */
    accountId: integer()
      .references(() => account.id, { onDelete: "cascade" })
      .notNull(),
    /** The client. */
    clientId: smallint().notNull(),
    /** The collection which the client is connected to. */
    collectionId: smallint().notNull(),
    /** The most recent item change that was received by the client. */
    lastItemChanged: timestamp(),
    /** The date the collection was last fetched. */
    lastFetch: timestamp(),
    /** The date the collection was last checked for deleted or changed items. */
    lastConsistencyCheck: timestamp(),
    /** The item ids of the collection that are expected to have been stored in the client. The ids are 4 bytes long. */
    ids: bytea(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.accountId, table.clientId, table.collectionId],
    }),
    clientFk: foreignKey({
      columns: [table.accountId, table.clientId],
      foreignColumns: [client.accountId, client.id],
    }).onDelete("cascade"),
    collectionFk: foreignKey({
      columns: [table.accountId, table.collectionId],
      foreignColumns: [collection.accountId, collection.id],
    }).onDelete("cascade"),
  })
);

export type ClientCollectionConnection =
  typeof clientCollectionConnection.$inferSelect;

// Define relations
export const collectionRelations = relations(collection, ({ many }) => ({
  clientCollectionConnections: many(clientCollectionConnection),
}));

export const clientCollectionConnectionRelations = relations(
  clientCollectionConnection,
  ({ one }) => ({
    collection: one(collection, {
      fields: [
        clientCollectionConnection.accountId,
        clientCollectionConnection.collectionId,
      ],
      references: [collection.accountId, collection.id],
    }),
  })
);

/** Mappings of ids from the source to the collection. This is used in case that there are collisions in the integer id space. */
export const itemIdConflictResolution = dataSchema.table(
  "item_id_conflict_resolution",
  {
    /** The account which owns the id mapping. */
    accountId: integer()
      .references(() => account.id, { onDelete: "cascade" })
      .notNull(),
    /** The collection which the id mapping is connected to. */
    collectionId: smallint().notNull(),
    /** The id which is unique within the source collection. */
    sourceItemId: bytea().notNull(),
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
