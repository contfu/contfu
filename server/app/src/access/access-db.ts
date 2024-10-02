import {
  integer,
  pgSchema,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { bytea } from "../core/db/db-types";

export const accessSchema = pgSchema("access");

export const account = accessSchema.table("account", {
  id: serial("id").primaryKey(),
  key: bytea("key").unique().notNull(),
  email: text("email").unique().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

export type Account = typeof account.$inferSelect;
export type InsertAccount = typeof account.$inferInsert;

export const quotas = accessSchema.table("quotas", {
  id: serial("id")
    .primaryKey()
    .references(() => account.id),
  sources: integer("sources").notNull(),
  maxSources: integer("max_sources").notNull(),
  collections: integer("collections").notNull(),
  maxCollections: integer("max_collections").notNull(),
});

export type Quota = typeof quotas.$inferSelect;
export type InsertQuota = typeof quotas.$inferInsert;
