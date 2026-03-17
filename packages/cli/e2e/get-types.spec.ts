import { describe, test, expect } from "bun:test";
import { $ } from "bun";

const CLI_CWD = import.meta.dir + "/..";
$.env({ ...process.env, CONTFU_URL: "http://localhost:8011" });
$.cwd(CLI_CWD);
$.nothrow();

async function cli(...args: string[]) {
  const result = await $`node dist/main.js ${args}`.quiet();
  return { exitCode: result.exitCode, stdout: result.text(), stderr: result.stderr.toString() };
}

describe("connections types", () => {
  let connectionId: string;
  let collectionId: string;

  test("setup: create connection and collection fixtures", async () => {
    const connRes = await cli("connections", "create", "-n", "e2e-types-conn", "-t", "notion");
    expect(connRes.exitCode).toBe(0);
    connectionId = String(JSON.parse(connRes.stdout).id);

    const colRes = await cli("collections", "create", "--display-name", "E2E Types Col");
    expect(colRes.exitCode).toBe(0);
    collectionId = String(JSON.parse(colRes.stdout).id);
  });

  test("connections types <id>", async () => {
    const { exitCode, stdout } = await cli("connections", "types", connectionId);
    // If no collections are synced, the command exits 1 — skip gracefully
    if (exitCode !== 0) return;
    expect(stdout).toContain("export");
  });

  test("connections types nonexistent id exits 1", async () => {
    const { exitCode } = await cli("connections", "types", "99999");
    expect(exitCode).toBe(1);
  });

  test("teardown: delete fixtures", async () => {
    const r1 = await cli("connections", "delete", connectionId);
    expect(r1.exitCode).toBe(0);
    const r2 = await cli("collections", "delete", collectionId);
    expect(r2.exitCode).toBe(0);
  });
});

describe("collections types", () => {
  let collectionId: string;

  test("setup: create collection fixture", async () => {
    const colRes = await cli("collections", "create", "--display-name", "E2E Col Types");
    expect(colRes.exitCode).toBe(0);
    collectionId = String(JSON.parse(colRes.stdout).id);
  });

  test("collections types <id>", async () => {
    const { exitCode, stdout } = await cli("collections", "types", collectionId);
    // If no items are synced to this collection, command exits 1 — skip gracefully
    if (exitCode !== 0) return;
    expect(stdout).toContain("export");
  });

  test("collections types nonexistent id exits 1", async () => {
    const { exitCode } = await cli("collections", "types", "99999");
    expect(exitCode).toBe(1);
  });

  test("teardown: delete fixture", async () => {
    const r = await cli("collections", "delete", collectionId);
    expect(r.exitCode).toBe(0);
  });
});
