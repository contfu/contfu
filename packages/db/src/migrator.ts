import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./db";

console.log("Migrating DB ...");
await migrate(db, { migrationsFolder: "./migrations" });
console.log("DB migrated");
