import {
  integer,
  pgSchema,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { bytea } from "../../core/db/db-types";

export const accessSchema = pgSchema("access");

export const account = accessSchema.table("account", {
  id: serial().primaryKey(),
  email: text().unique().notNull(),
  activeUntil: timestamp(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp(),
});

export type Account = typeof account.$inferSelect;
export type InsertAccount = typeof account.$inferInsert;

export const quota = accessSchema.table("quota", {
  id: serial()
    .primaryKey()
    .references(() => account.id, { onDelete: "cascade" }),
  sources: integer().notNull(),
  maxSources: integer().notNull(),
  collections: integer().notNull(),
  maxCollections: integer().notNull(),
  items: integer().notNull(),
  maxItems: integer().notNull(),
  clients: integer().notNull(),
  maxClients: integer().notNull(),
});

export type Quota = typeof quota.$inferSelect;
export type InsertQuota = typeof quota.$inferInsert;

export const client = accessSchema.table(
  "client",
  {
    accountId: integer()
      .notNull()
      .references(() => account.id, { onDelete: "cascade" }),
    id: smallint().notNull(),
    key: bytea().notNull().unique(),
    name: text(),
    connectedTo: smallint(),
    createdAt: timestamp().defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.accountId, t.id] }),
  })
);

export type Client = typeof client.$inferSelect;
export type InsertClient = typeof client.$inferInsert;
