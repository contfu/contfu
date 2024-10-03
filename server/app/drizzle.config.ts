import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./src/**/*-db.ts",
  dialect: "postgresql",
  out: "./migrations",
});
