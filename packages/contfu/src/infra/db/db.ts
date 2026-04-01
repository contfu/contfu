import { detectRuntime } from "../../util/runtime";
export type { DbCtx } from "./db-bun";

const hiddenImport = (path: string) => (0, eval)(`import("${path}")`) as Promise<any>;
const nodeCompiledModule = ["./db", "node.js"].join("-");
const nodeSourceModule = ["./db", "node"].join("-");

async function importDbModule(base: "db-bun" | "db-node") {
  try {
    if (base === "db-bun") {
      return await import("./db-bun.js");
    }
    return await hiddenImport(nodeCompiledModule);
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
      return import("./db-bun");
    }
    return hiddenImport(nodeSourceModule);
  }
}

const dbModule = await (detectRuntime() === "bun"
  ? importDbModule("db-bun")
  : importDbModule("db-node"));

// Preserve existing query ergonomics for internal call sites.
export const db = (dbModule as typeof import("./db-bun")).db;
