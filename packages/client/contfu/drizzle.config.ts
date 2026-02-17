import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/infra/db/schema.ts",
  dialect: "sqlite",
  out: "./db/migrations",
});
