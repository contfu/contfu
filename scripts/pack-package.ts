import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

type PackageJson = Record<string, unknown> & {
  name?: string;
  version?: string;
  workspaces?: unknown;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
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

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function findRepoRoot(startDir: string): Promise<string> {
  let currentDir = startDir;

  while (true) {
    const currentPackageJsonPath = resolve(currentDir, "package.json");

    if (existsSync(currentPackageJsonPath)) {
      const currentPackageJson = JSON.parse(
        await readFile(currentPackageJsonPath, "utf8"),
      ) as PackageJson;

      if (Array.isArray(currentPackageJson.workspaces)) {
        return currentDir;
      }
    }

    const parentDir = dirname(currentDir);

    if (parentDir === currentDir) {
      throw new Error(`Could not find workspace root for ${startDir}`);
    }

    currentDir = parentDir;
  }
}

async function collectWorkspaceVersions(repoRoot: string): Promise<Map<string, string>> {
  const packageVersions = new Map<string, string>();
  const packagesRoot = resolve(repoRoot, "packages");
  const topLevelEntries = await readdir(packagesRoot, { withFileTypes: true });

  for (const topLevelEntry of topLevelEntries) {
    if (!topLevelEntry.isDirectory()) continue;

    const topLevelDir = resolve(packagesRoot, topLevelEntry.name);
    const nestedEntries = await readdir(topLevelDir, { withFileTypes: true });
    const packageJsonCandidates = [resolve(topLevelDir, "package.json")];

    for (const nestedEntry of nestedEntries) {
      if (nestedEntry.isDirectory()) {
        packageJsonCandidates.push(resolve(topLevelDir, nestedEntry.name, "package.json"));
      }
    }

    for (const candidatePath of packageJsonCandidates) {
      if (!existsSync(candidatePath)) continue;

      const candidateJson = JSON.parse(await readFile(candidatePath, "utf8")) as PackageJson;

      if (candidateJson.name && candidateJson.version) {
        packageVersions.set(candidateJson.name, candidateJson.version);
      }
    }
  }

  return packageVersions;
}

function normalizeWorkspaceVersion(spec: string, version: string): string {
  const workspaceSpec = spec.slice("workspace:".length);

  if (workspaceSpec === "*" || workspaceSpec === "^") {
    return `^${version}`;
  }

  if (workspaceSpec === "~") {
    return `~${version}`;
  }

  return workspaceSpec || version;
}

function normalizeDependencyMap(
  dependencyMap: Record<string, unknown> | undefined,
  packageVersions: Map<string, string>,
): Record<string, unknown> | undefined {
  if (!dependencyMap) {
    return dependencyMap;
  }

  const normalizedDependencyMap = { ...dependencyMap };

  for (const [dependencyName, dependencySpec] of Object.entries(dependencyMap)) {
    if (typeof dependencySpec !== "string" || !dependencySpec.startsWith("workspace:")) {
      continue;
    }

    const dependencyVersion = packageVersions.get(dependencyName);

    if (!dependencyVersion) {
      continue;
    }

    normalizedDependencyMap[dependencyName] = normalizeWorkspaceVersion(
      dependencySpec,
      dependencyVersion,
    );
  }

  return normalizedDependencyMap;
}

let shouldRestore = false;
let exitCode = 0;

try {
  if (publishConfig) {
    const repoRoot = await findRepoRoot(packageDir);
    const packageVersions = await collectWorkspaceVersions(repoRoot);
    const packedManifest = {
      ...packageJson,
      ...publishConfig,
    } satisfies PackageJson;

    delete packedManifest.publishConfig;

    for (const field of dependencyFields) {
      const dependencyMap = packedManifest[field];

      if (isObjectRecord(dependencyMap)) {
        packedManifest[field] = normalizeDependencyMap(dependencyMap, packageVersions);
      }
    }

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
