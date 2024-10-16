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
  /** The id of the account. */
  id: serial().primaryKey(),
  /** The email of the account. */
  email: text().unique().notNull(),
  /**
   * The time the account is active. If it is in the past, the account is inactive.
   * If it is null, the account is active forever.
   */
  activeUntil: timestamp(),
  /** The time the account was created. */
  createdAt: timestamp().defaultNow().notNull(),
  /** The time the account was updated. */
  updatedAt: timestamp(),
});

export type DbAccount = typeof account.$inferSelect;

export const quota = accessSchema.table("quota", {
  /** The account id that the quota belongs to. */
  id: serial()
    .primaryKey()
    .references(() => account.id, { onDelete: "cascade" }),
  /** The number of sources. */
  sources: integer().notNull(),
  /** The maximum number of sources. */
  maxSources: integer().notNull(),
  /** The number of collections. */
  collections: integer().notNull(),
  /** The maximum number of collections. */
  maxCollections: integer().notNull(),
  /** The number of items. */
  items: integer().notNull(),
  /** The maximum number of items. */
  maxItems: integer().notNull(),
  /** The number of clients. */
  clients: integer().notNull(),
  /** The maximum number of clients. */
  maxClients: integer().notNull(),
});

export type DbQuota = typeof quota.$inferSelect;

export const consumer = accessSchema.table(
  "consumer",
  {
    /** The account id that the consumer belongs to. */
    accountId: integer()
      .notNull()
      .references(() => account.id, { onDelete: "cascade" }),
    /** The id of the consumer. */
    id: smallint().notNull(),
    /** The key of the consumer. If null, the consumer is internal. */
    key: bytea().unique(),
    /** The name of the consumer. */
    name: text().notNull(),
    /** The server id that the consumer is connected to. */
    connectedTo: smallint(),
    /** The time the consumer was created. */
    createdAt: timestamp().defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.accountId, t.id] }),
  })
);

export type DbConsumer = typeof consumer.$inferSelect;
