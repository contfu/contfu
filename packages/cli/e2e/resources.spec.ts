import { describe, test, expect } from "bun:test";
import { $ } from "bun";

const CLI_CWD = import.meta.dir + "/..";
const env = { ...process.env, CONTFU_URL: "http://localhost:8011" };

$.cwd(CLI_CWD);
$.env(env);
$.nothrow();

async function cli(...args: string[]) {
  const result = await $`node dist/main.js ${args}`.quiet();
  return { exitCode: result.exitCode, stdout: result.text(), stderr: result.stderr.toString() };
}

let createdSourceId: string;

describe("resource commands", () => {
  test("sources list", async () => {
    const { exitCode, stdout } = await cli("sources", "list");
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toBeInstanceOf(Array);
  });

  test("sources create", async () => {
    const { exitCode, stdout } = await cli(
      "sources",
      "create",
      "-d",
      '{"name":"e2e-test","type":1}',
    );
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.name).toBe("e2e-test");
    createdSourceId = String(data.id);
  });

  test("sources get", async () => {
    const { exitCode, stdout } = await cli("sources", "get", createdSourceId);
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.name).toBe("e2e-test");
  });

  test("sources set", async () => {
    const { exitCode, stdout } = await cli(
      "sources",
      "set",
      createdSourceId,
      "-d",
      '{"name":"e2e-renamed"}',
    );
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.name).toBe("e2e-renamed");
  });

  test("sources delete", async () => {
    const { exitCode } = await cli("sources", "delete", createdSourceId);
    expect(exitCode).toBe(0);
  });

  test("sources get after delete returns 404", async () => {
    const { exitCode } = await cli("sources", "get", createdSourceId);
    expect(exitCode).toBe(1);
  });

  test("collections list", async () => {
    const { exitCode, stdout } = await cli("collections", "list");
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toBeInstanceOf(Array);
  });
});

describe("error cases", () => {
  test("invalid command exits 1 with usage", async () => {
    const { exitCode, stderr } = await cli("bogus");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown command");
  });

  test("missing API key exits 1", async () => {
    const result = await $`node dist/main.js sources list`
      .env({ ...env, CONTFU_API_KEY: "", HOME: "/tmp/nonexistent" })
      .quiet()
      .nothrow();
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("No API key");
  });

  test("wrong API key exits 1", async () => {
    const result = await $`node dist/main.js sources list`
      .env({ ...env, CONTFU_API_KEY: "invalid-key" })
      .quiet()
      .nothrow();
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("Error");
  });
});
