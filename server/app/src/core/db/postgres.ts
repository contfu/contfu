import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const opts: postgres.Options<{}> = {
  host: Bun.env.DB_HOST ?? "localhost",
  port: Number(Bun.env.DB_PORT ?? 5432),
  database: Bun.env.DB_NAME ?? "contfu",
  user: Bun.env.DB_USER ?? "contfu",
  password: Bun.env.DB_USER_PASSWORD ?? "contfu",
};
const migrationClient = postgres({ ...opts, max: 1 });

await migrate(drizzle(migrationClient), { migrationsFolder: "./migrations" });

const client = postgres(opts);

export const db = drizzle(client);

export function withSchema<T extends Record<string, unknown>>(schema: T) {
  return drizzle(client, { schema });
}
