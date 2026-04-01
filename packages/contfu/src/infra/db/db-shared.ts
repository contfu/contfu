import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const dbUrl: string = process.env.DATABASE_URL ?? ":memory:";

export function resolveMigrationsFolder(): string | null {
  const byModulePath = join(dirname(fileURLToPath(import.meta.url)), "../../../db/migrations");
  const byRepoRoot = join(process.cwd(), "packages/contfu/db/migrations");
  const byPackageRoot = join(process.cwd(), "db/migrations");

  const candidates = [byModulePath, byRepoRoot, byPackageRoot];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export async function ensureDbDir(url: string) {
  if (url !== ":memory:") {
    await mkdir(dirname(url), { recursive: true });
  }
}
