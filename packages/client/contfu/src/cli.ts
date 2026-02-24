#!/usr/bin/env bun
import { writeFile } from "node:fs/promises";
import { generateTypes } from "./features/collections/generateTypes";
import { getAllCollectionSchemas } from "./features/collections/getAllCollectionSchemas";

const args = process.argv.slice(2);
const cmd = args[0];

if (cmd !== "generate-types") {
  console.error(`Unknown command: ${cmd ?? "(none)"}`);
  console.error("Usage: contfu generate-types [--out <path>]");
  process.exit(1);
}

const outIndex = args.indexOf("--out");
const outPath = outIndex !== -1 ? args[outIndex + 1] : "contfu-types.ts";

const schemas = await getAllCollectionSchemas();
const output = generateTypes(schemas);
await writeFile(outPath, output, "utf-8");
console.log(`Types written to ${outPath}`);
