import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "../app/src/core/db/schema.ts",
  dialect: "sqlite",
  out: "./db/migrations",
});
