import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/infra/db/schema.ts",
  dialect: "postgresql",
  out: "./db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://contfu:contfu@localhost:5432/contfu",
  },
});
