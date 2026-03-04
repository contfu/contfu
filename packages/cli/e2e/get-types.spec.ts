import { describe, test, expect, afterEach } from "bun:test";
import { unlinkSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

const CLI_CWD = import.meta.dir + "/..";
$.env({ ...process.env, CONTFU_URL: "http://localhost:8011" });
$.cwd(CLI_CWD);
$.nothrow();

async function cli(...args: string[]) {
  const result = await $`node dist/main.js ${args}`.quiet();
  return { exitCode: result.exitCode, stdout: result.text(), stderr: result.stderr.toString() };
}

const outFile = join(CLI_CWD, "test-types.ts");

afterEach(() => {
  try {
    unlinkSync(outFile);
  } catch {}
});

describe("get-types", () => {
  test("by collection name writes types file", async () => {
    const listRes = await cli("collections", "list");
    const collections = JSON.parse(listRes.stdout);
    if (collections.length === 0) return;

    const name = collections[0].name;
    const { exitCode } = await cli("get-types", name, "--out", outFile);
    expect(exitCode).toBe(0);
    const content = readFileSync(outFile, "utf-8");
    expect(content).toContain("export interface");
  });

  test("nonexistent target exits 1", async () => {
    const { exitCode } = await cli("get-types", "nonexistent-collection-xyz");
    expect(exitCode).toBe(1);
  });
});
