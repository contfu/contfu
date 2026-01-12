import {
  blob,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const pageTable = sqliteTable("page", {
  id: blob({ mode: "buffer" }).primaryKey(),
  path: text().unique().notNull(),
  collection: text(),
  title: text().notNull(),
  description: text().notNull(),
  content: text(),
  props: text(),
  author: text(),
  connection: integer().notNull(),
  publishedAt: integer().notNull(),
  createdAt: integer().notNull(),
  updatedAt: integer(),
  changedAt: integer().notNull(),
});

export type DbPage = typeof pageTable.$inferSelect;
export type NewPage = typeof pageTable.$inferInsert;
export type PageUpdate = Partial<NewPage>;

export const pageLinkTable = sqliteTable(
  "pageLink",
  {
    type: text().notNull(),
    from: blob({ mode: "buffer" })
      .notNull()
      .references(() => pageTable.id, { onDelete: "cascade" }),
    to: blob({ mode: "buffer" })
      .notNull()
      .references(() => pageTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.type, t.from, t.to] })],
);

export type DbPageLink = typeof pageLinkTable.$inferSelect;
export type NewPageLink = typeof pageLinkTable.$inferInsert;
export type PageLinkUpdate = Partial<NewPageLink>;
