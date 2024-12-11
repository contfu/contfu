import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { schema } from "./schema";

const client = createClient({
  url: process.env.DATABASE_URL ?? ":memory:",
  ...(process.env.DATABASE_SYNC_URL
    ? { syncUrl: process.env.DATABASE_SYNC_URL }
    : {}),
});

export const db = drizzle(client, { schema });
