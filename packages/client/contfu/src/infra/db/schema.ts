import { blob, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const itemsTable = sqliteTable("items", {
  id: blob({ mode: "buffer" }).primaryKey(),
  ref: text().notNull(),
  collection: integer()
    .notNull()
    .references(() => collectionTable.id, { onDelete: "cascade" }),
  props: text(),
  content: text(),
  changedAt: integer().notNull(),
});

export type DbItem = typeof itemsTable.$inferSelect;
export type NewItem = typeof itemsTable.$inferInsert;
export type ItemUpdate = Partial<NewItem>;

export const linkTable = sqliteTable(
  "links",
  {
    type: text().notNull(),
    from: blob({ mode: "buffer" })
      .notNull()
      .references(() => itemsTable.id, { onDelete: "cascade" }),
    to: blob({ mode: "buffer" })
      .notNull()
      .references(() => itemsTable.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.type, table.from, table.to] })],
);

export type DbItemLink = typeof linkTable.$inferSelect;
export type NewItemLink = typeof linkTable.$inferInsert;
export type ItemLinkUpdate = Partial<NewItemLink>;

/** @deprecated Use DbItemLink instead. */
export type DbPageLink = DbItemLink;
/** @deprecated Use NewItemLink instead. */
export type NewPageLink = NewItemLink;
/** @deprecated Use ItemLinkUpdate instead. */
export type PageLinkUpdate = ItemLinkUpdate;

export const collectionTable = sqliteTable("collection", {
  id: integer().primaryKey(),
  ref: text().unique().notNull(),
  name: text().notNull(),
  createdAt: integer().notNull(),
  updatedAt: integer(),
});

export const assetTable = sqliteTable("asset", {
  id: blob({ mode: "buffer" }).primaryKey(),
  itemId: blob("pageId", { mode: "buffer" })
    .notNull()
    .references(() => itemsTable.id, { onDelete: "cascade" }),
  canonical: text().unique().notNull(),
  originalUrl: text().notNull(),
  format: text().notNull(),
  size: integer().notNull(),
  createdAt: integer().notNull(),
});

export type DbAsset = typeof assetTable.$inferSelect;
export type NewAsset = typeof assetTable.$inferInsert;
export type AssetUpdate = Partial<NewAsset>;
