import { detectRuntime } from "../../util/runtime";

async function importDbModule(base: "db-bun" | "db-node") {
  try {
    if (base === "db-bun") {
      return await import("./db-bun.js");
    }
    return await import("./db-node.js");
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { url?: string };
    const missingCompiledSibling =
      e?.code === "ERR_MODULE_NOT_FOUND" &&
      typeof e.url === "string" &&
      e.url.endsWith(`/${base}.js`);
    if (!missingCompiledSibling) {
      throw err;
    }
    if (base === "db-bun") {
      return await import("./db-bun");
    }
    return await import("./db-node");
  }
}

const dbModule = await (detectRuntime() === "bun"
  ? importDbModule("db-bun")
  : importDbModule("db-node"));

// Preserve existing query ergonomics for internal call sites.
export const db = (dbModule as typeof import("./db-bun")).db;
