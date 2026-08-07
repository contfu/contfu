import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const packageJsonPath = new URL("../../package.json", import.meta.url);

async function createInstalledPackage(): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "contfu-strapi-exports-"));
  const packageDir = join(tempDir, "node_modules", "@contfu", "strapi");
  await mkdir(join(packageDir, "dist", "server"), { recursive: true });
  await writeFile(join(packageDir, "package.json"), await readFile(packageJsonPath, "utf8"));
  await writeFile(
    join(packageDir, "dist", "server", "index.js"),
    "module.exports = () => ({ name: 'contfu' });\n",
  );
  await writeFile(
    join(packageDir, "dist", "server", "index.d.ts"),
    "declare const plugin: () => unknown; export = plugin;\n",
  );
  return tempDir;
}

describe("package exports", () => {
  test("publishes a human-readable Strapi plugin description", async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      strapi?: { description?: unknown };
    };
    const description = packageJson.strapi?.description;

    expect(description).toBe("Send signed Strapi webhooks to Contfu.");
    expect(description).not.toContain("global.plugins.contfu.description");
  });

  test("exposes the Strapi plugin at the package root", async () => {
    const tempDir = await createInstalledPackage();

    try {
      const result = spawnSync(
        process.execPath,
        [
          "-e",
          "const plugin = require('@contfu/strapi'); if (typeof plugin !== 'function') process.exit(2);",
        ],
        { cwd: tempDir, encoding: "utf8" },
      );

      expect(result.status, result.stderr).toBe(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("keeps the explicit strapi-server subpath exported", async () => {
    const tempDir = await createInstalledPackage();

    try {
      const result = spawnSync(
        process.execPath,
        [
          "-e",
          "const plugin = require('@contfu/strapi/strapi-server'); if (typeof plugin !== 'function') process.exit(2);",
        ],
        { cwd: tempDir, encoding: "utf8" },
      );

      expect(result.status, result.stderr).toBe(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
