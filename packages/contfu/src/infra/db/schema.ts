import type { Block, CollectionSchema, ConnectionType } from "@contfu/core";
import { blob, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const collectionsTable = sqliteTable("collections", {
  name: text().primaryKey(),
  displayName: text().notNull(),
  schema: blob({ mode: "json" }).notNull().$type<CollectionSchema>(),
});

export const itemsTable = sqliteTable(
  "items",
  {
    id: blob({ mode: "buffer" }).primaryKey(),
    connectionType: integer().$type<ConnectionType | null>(),
    ref: text(),
    collection: text()
      .notNull()
      .references(() => collectionsTable.name, { onUpdate: "cascade" }),
    props: blob({ mode: "json" }).$type<Record<string, unknown>>(),
    content: blob({ mode: "json" }).$type<Block[] | null>(),
    changedAt: integer().notNull(),
  },
  (table) => [
    index("idx_items_ref").on(table.ref),
    index("idx_items_collection").on(table.collection),
    index("idx_items_changedAt").on(table.changedAt),
  ],
);

export type DbItem = typeof itemsTable.$inferSelect;
export type NewItem = typeof itemsTable.$inferInsert;
export type ItemUpdate = Partial<NewItem>;

export const linkTable = sqliteTable(
  "links",
  {
    id: integer().primaryKey(),
    prop: text(),
    from: blob({ mode: "buffer" })
      .notNull()
      .references(() => itemsTable.id, { onDelete: "cascade" }),
    to: blob({ mode: "buffer" }).notNull(),
    internal: integer({ mode: "boolean" }).notNull(),
  },
  (table) => [index("idx_links_from").on(table.from, table.to), index("idx_links_to").on(table.to)],
);

export type DbItemLink = typeof linkTable.$inferSelect;
export type NewItemLink = typeof linkTable.$inferInsert;

export const syncTable = sqliteTable("sync", {
  index: integer().notNull(),
});

export const assetTable = sqliteTable("asset", {
  id: blob({ mode: "buffer" }).primaryKey(),
  originalUrl: text().notNull(),
  mediaType: text().notNull(),
  ext: text().notNull(),
  size: integer().notNull(),
  data: blob({ mode: "buffer" }),
  createdAt: integer().notNull(),
});

export type DbAsset = typeof assetTable.$inferSelect;
export type NewAsset = typeof assetTable.$inferInsert;
export type AssetUpdate = Partial<NewAsset>;

export const itemAssetTable = sqliteTable(
  "item_asset",
  {
    itemId: blob({ mode: "buffer" })
      .notNull()
      .references(() => itemsTable.id, { onDelete: "cascade" }),
    assetId: blob({ mode: "buffer" })
      .notNull()
      .references(() => assetTable.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.itemId, table.assetId] })],
);

export const mediaVariantTable = sqliteTable(
  "media_variant",
  {
    assetId: blob({ mode: "buffer" })
      .notNull()
      .references(() => assetTable.id, { onDelete: "cascade" }),
    ext: text().notNull(),
    optsHash: integer().notNull(),
    opts: blob({ mode: "json" }).$type<Record<string, unknown>>(),
    size: integer().notNull(),
    data: blob({ mode: "buffer" }).notNull(),
    createdAt: integer().notNull(),
  },
  (table) => [primaryKey({ columns: [table.assetId, table.ext, table.optsHash] })],
);
