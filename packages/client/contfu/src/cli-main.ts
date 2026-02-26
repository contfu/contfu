import { writeFile } from "node:fs/promises";

function printUsage() {
  console.error("Usage: contfu generate-types [--out <path>]");
}

export async function main(argv = process.argv.slice(2)) {
  const cmd = argv[0];

  if (cmd == null || cmd === "--help" || cmd === "-h") {
    printUsage();
    process.exit(cmd == null ? 1 : 0);
  }

  if (cmd !== "generate-types") {
    console.error(`Unknown command: ${cmd ?? "(none)"}`);
    printUsage();
    process.exit(1);
  }

  const outIndex = argv.indexOf("--out");
  const outPath = outIndex !== -1 ? argv[outIndex + 1] : "contfu-types.ts";

  const [{ generateTypes }, { getAllCollectionSchemas }] = await Promise.all([
    import("./features/collections/generateTypes"),
    import("./features/collections/getAllCollectionSchemas"),
  ]);
  const schemas = await getAllCollectionSchemas();
  const output = generateTypes(schemas);
  await writeFile(outPath, output, "utf-8");
  console.log(`Types written to ${outPath}`);
}
