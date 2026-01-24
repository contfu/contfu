import { blob, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const itemsTable = sqliteTable("items", {
  id: blob({ mode: "buffer" }).primaryKey(),
  ref: text().notNull(),
  path: text().unique().notNull(),
  collection: integer()
    .notNull()
    .references(() => collectionTable.id, { onDelete: "cascade" }),
  title: text().notNull(),
  description: text().notNull(),
  content: text(),
  props: text(),
  author: text(),
  connection: blob({ mode: "buffer" }).notNull(),
  publishedAt: integer().notNull(),
  createdAt: integer().notNull(),
  updatedAt: integer(),
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
  (t) => [primaryKey({ columns: [t.type, t.from, t.to] })],
);

export type DbPageLink = typeof linkTable.$inferSelect;
export type NewPageLink = typeof linkTable.$inferInsert;
export type PageLinkUpdate = Partial<NewPageLink>;

export const collectionTable = sqliteTable("collection", {
  id: integer().primaryKey(),
  name: text().notNull(),
  createdAt: integer().notNull(),
  updatedAt: integer(),
});

export const assetTable = sqliteTable("asset", {
  id: blob({ mode: "buffer" }).primaryKey(),
  pageId: blob({ mode: "buffer" })
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
