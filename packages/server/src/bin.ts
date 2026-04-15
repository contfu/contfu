import { parseArgs } from "node:util";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    db: { type: "string" },
    port: { type: "string" },
  },
  strict: true,
});

const port = values.port ? Number.parseInt(values.port, 10) : undefined;

const { default: serve } = await import("./index");
serve({
  db: values.db ?? process.env.CONTFU_DB ?? process.env.DATABASE_URL,
  port: port ?? (process.env.PORT ? Number.parseInt(process.env.PORT, 10) : undefined),
});
