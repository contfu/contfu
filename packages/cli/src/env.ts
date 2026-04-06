import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";

export function getAppKey(): string | undefined {
  if (process.env.CONTFU_KEY) return process.env.CONTFU_KEY;
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return undefined;
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^CONTFU_KEY=(.+)$/);
      if (match) return match[1].trim();
    }
  } catch {
    // ignore
  }
  return undefined;
}

export function writeEnvKey(envPath: string, key: string): void {
  const resolved = resolve(envPath);
  const line = `\nCONTFU_KEY=${key}\n`;
  appendFileSync(resolved, line, "utf-8");
  console.log(`✓ CONTFU_KEY written to ${envPath}`);
}

export function ensureGitignore(): void {
  const gitignorePath = join(process.cwd(), ".gitignore");
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, "utf-8");
    if (!content.includes(".env")) {
      appendFileSync(gitignorePath, "\n.env\n", "utf-8");
      console.log("✓ Added .env to .gitignore");
    }
  }
}
