import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const textFileExtensions = new Set([".js", ".d.ts"]);
const relativeImportPattern = /((?:from\s+|import\s*\(\s*)["'])(\.{1,2}\/[^"']+)(["'])/g;
const allowedSpecifierExtensions = [".js", ".mjs", ".cjs", ".json"];

export type RewrittenFile = {
  path: string;
  originalContents: string;
  rewrittenContents: string;
};

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const entryPath = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      yield* walk(entryPath);
      continue;
    }

    if (textFileExtensions.has(extname(entry.name)) || entry.name.endsWith(".d.ts")) {
      yield entryPath;
    }
  }
}

function needsJsExtension(specifier: string) {
  return !allowedSpecifierExtensions.some((extension) => specifier.endsWith(extension));
}

export async function rewriteRelativeEsmImports(targetDir: string): Promise<RewrittenFile[]> {
  const rewrittenFiles: RewrittenFile[] = [];
  const remainingViolations: string[] = [];

  for await (const filePath of walk(targetDir)) {
    const originalContents = await readFile(filePath, "utf8");

    const rewrittenContents = originalContents.replace(
      relativeImportPattern,
      (full, prefix, specifier, suffix) => {
        if (!needsJsExtension(specifier)) {
          return full;
        }

        return `${prefix}${specifier}.js${suffix}`;
      },
    );

    if (rewrittenContents !== originalContents) {
      await writeFile(filePath, rewrittenContents);
      rewrittenFiles.push({ path: filePath, originalContents, rewrittenContents });
    }

    const unresolved = [...rewrittenContents.matchAll(relativeImportPattern)]
      .map(([, , specifier]) => specifier)
      .filter(needsJsExtension);

    if (unresolved.length > 0) {
      remainingViolations.push(`${filePath}: ${unresolved.join(", ")}`);
    }
  }

  if (remainingViolations.length > 0) {
    throw new Error(
      `Found relative imports without explicit .js extensions:\n${remainingViolations.map((violation) => `- ${violation}`).join("\n")}`,
    );
  }

  return rewrittenFiles;
}

if (import.meta.main) {
  const [targetDir = "dist"] = process.argv.slice(2);
  const resolvedTargetDir = resolve(process.cwd(), targetDir);
  const rewrittenFiles = await rewriteRelativeEsmImports(resolvedTargetDir);
  console.log(
    `Rewrote relative ESM imports in ${rewrittenFiles.length} files under ${resolvedTargetDir}.`,
  );
}
