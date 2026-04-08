import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type PackageJson = Record<string, unknown> & {
  publishConfig?: Record<string, unknown>;
};

const [packageArg = ".", ...packArgs] = process.argv.slice(2);

const packageDir = resolve(process.cwd(), packageArg);
const packageJsonPath = resolve(packageDir, "package.json");

if (!existsSync(packageJsonPath)) {
  console.error(`Package manifest not found: ${packageJsonPath}`);
  process.exit(1);
}

const originalContents = await readFile(packageJsonPath, "utf8");
const packageJson = JSON.parse(originalContents) as PackageJson;
const publishConfig = packageJson.publishConfig;

let shouldRestore = false;
let exitCode = 0;

try {
  if (publishConfig) {
    const packedManifest = {
      ...packageJson,
      ...publishConfig,
    } satisfies PackageJson;

    delete packedManifest.publishConfig;

    await writeFile(packageJsonPath, `${JSON.stringify(packedManifest, null, 2)}\n`);
    shouldRestore = true;
  }

  const pack = Bun.spawn({
    cmd: ["bun", "pm", "pack", ...packArgs],
    cwd: packageDir,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  exitCode = await pack.exited;
} finally {
  if (shouldRestore) {
    await writeFile(packageJsonPath, originalContents);
  }
}

if (exitCode !== 0) {
  process.exit(exitCode);
}
