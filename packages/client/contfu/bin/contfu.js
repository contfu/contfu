#!/usr/bin/env node

import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const isBun = typeof globalThis.Bun !== "undefined";
const here = dirname(fileURLToPath(import.meta.url));
const entry = isBun ? join(here, "../dist/cli.bun.js") : join(here, "../dist/cli.node.js");

await import(pathToFileURL(entry).href);
