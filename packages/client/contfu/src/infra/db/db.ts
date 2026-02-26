import { detectRuntime } from "../../util/runtime";

// Keep runtime-specific module specifiers out of this file. Bun's bundler
// statically analyzes import specifiers even when they are runtime-gated.
const dynamicImport = (path: string) =>
  new Function("p", "return import(p)")(path) as Promise<
    typeof import("./db-bun") | typeof import("./db-node")
  >;

async function importDbModule(base: "db-bun" | "db-node") {
  try {
    return await dynamicImport(new URL(`./${base}.js`, import.meta.url).href);
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { url?: string };
    const missingCompiledSibling =
      e?.code === "ERR_MODULE_NOT_FOUND" &&
      typeof e.url === "string" &&
      e.url.endsWith(`/${base}.js`);
    if (!missingCompiledSibling) {
      throw err;
    }
    return await dynamicImport(new URL(`./${base}.ts`, import.meta.url).href);
  }
}

const dbModule = await (detectRuntime() === "bun"
  ? importDbModule("db-bun")
  : importDbModule("db-node"));

// Preserve existing query ergonomics for internal call sites.
export const db = (dbModule as typeof import("./db-bun")).db;
