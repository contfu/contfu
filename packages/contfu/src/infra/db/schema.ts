import type { Block, CollectionSchema, EffectiveCollectionI18nConfig } from "@contfu/core";
import { blob, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const collectionsTable = sqliteTable("collections", {
  name: text().primaryKey(),
  displayName: text().notNull(),
  schema: blob({ mode: "json" }).notNull().$type<CollectionSchema>(),
  i18n: blob({ mode: "json" }).$type<EffectiveCollectionI18nConfig | null>(),
});

export const itemsTable = sqliteTable(
  "items",
  {
    id: integer().primaryKey(),
    collection: text()
      .notNull()
      .references(() => collectionsTable.name, { onUpdate: "cascade" }),
    props: blob({ mode: "json" }).$type<Record<string, unknown>>(),
    locale: text(),
    content: blob({ mode: "json" }).$type<Block[] | null>(),
    changedAt: integer().notNull(),
    deletedAt: integer(),
  },
  (table) => [
    index("idx_items_collection").on(table.collection),
    index("idx_items_locale").on(table.locale),
    index("idx_items_changedAt").on(table.changedAt),
    index("idx_items_deletedAt").on(table.deletedAt),
  ],
);

export type DbItem = typeof itemsTable.$inferSelect;
export type NewItem = typeof itemsTable.$inferInsert;
export type ItemUpdate = Partial<NewItem>;

export const internalLinkTable = sqliteTable(
  "internal_links",
  {
    id: integer().primaryKey(),
    prop: text(),
    from: integer()
      .notNull()
      .references(() => itemsTable.id, { onDelete: "cascade" }),
    to: integer().notNull(),
  },
  (table) => [
    index("idx_internal_links_from").on(table.from, table.to),
    index("idx_internal_links_to").on(table.to),
  ],
);

export type DbInternalItemLink = typeof internalLinkTable.$inferSelect;
export type NewInternalItemLink = typeof internalLinkTable.$inferInsert;

export const externalLinkTable = sqliteTable(
  "external_links",
  {
    id: integer().primaryKey(),
    from: integer()
      .notNull()
      .references(() => itemsTable.id, { onDelete: "cascade" }),
    url: text().notNull(),
  },
  (table) => [index("idx_external_links_from").on(table.from)],
);

export type DbExternalItemLink = typeof externalLinkTable.$inferSelect;
export type NewExternalItemLink = typeof externalLinkTable.$inferInsert;

export const syncTable = sqliteTable("sync", {
  index: integer().notNull(),
});

export const fileTable = sqliteTable("files", {
  id: blob({ mode: "buffer" }).primaryKey(),
  status: integer().notNull(),
  mediaType: text().notNull(),
  meta: blob({ mode: "json" }).notNull().$type<Record<string, unknown>>(),
  data: blob({ mode: "buffer" }),
  createdAt: integer().notNull(),
});

export type DbFile = typeof fileTable.$inferSelect;
export type NewFile = typeof fileTable.$inferInsert;
export type FileUpdate = Partial<NewFile>;

export const mediaMasterTable = sqliteTable("media_masters", {
  fileId: blob({ mode: "buffer" })
    .primaryKey()
    .references(() => fileTable.id, { onDelete: "cascade" }),
  mediaType: text().notNull(),
  ext: text().notNull(),
  format: text().notNull(),
  configFingerprint: integer().notNull(),
  metadata: blob({ mode: "json" }).notNull().$type<Record<string, unknown>>(),
  data: blob({ mode: "buffer" }).notNull(),
  createdAt: integer().notNull(),
  updatedAt: integer().notNull(),
});

export type DbMediaMaster = typeof mediaMasterTable.$inferSelect;
export type NewMediaMaster = typeof mediaMasterTable.$inferInsert;

export const itemFileTable = sqliteTable(
  "item_files",
  {
    itemId: integer()
      .notNull()
      .references(() => itemsTable.id, { onDelete: "cascade" }),
    fileId: blob({ mode: "buffer" })
      .notNull()
      .references(() => fileTable.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.itemId, table.fileId] })],
);

export const mediaVariantTable = sqliteTable(
  "media_variants",
  {
    fileId: blob({ mode: "buffer" })
      .notNull()
      .references(() => fileTable.id, { onDelete: "cascade" }),
    ext: text().notNull(),
    optsHash: integer().notNull(),
    opts: blob({ mode: "json" }).$type<Record<string, unknown>>(),
    size: integer().notNull(),
    data: blob({ mode: "buffer" }).notNull(),
    createdAt: integer().notNull(),
  },
  (table) => [primaryKey({ columns: [table.fileId, table.ext, table.optsHash] })],
);
