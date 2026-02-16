import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/infra/db/schema.ts",
  dialect: "postgresql",
  out: "./db/migrations",
  entities: {
    roles: {
      include: ["app_user", "service_role"],
    },
  },
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://contfu:contfu@localhost:5432/contfu",
  },
});
