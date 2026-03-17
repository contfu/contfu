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

describe("connections lifecycle", () => {
  let connectionId: string;

  test("connections list -f json", async () => {
    const { exitCode, stdout } = await cli("connections", "list", "-f", "json");
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toBeInstanceOf(Array);
  });

  test("connections create", async () => {
    const { exitCode, stdout } = await cli(
      "connections",
      "create",
      "-n",
      "e2e-test",
      "-t",
      "notion",
    );
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.label).toBe("e2e-test");
    connectionId = String(data.id);
  });

  test("connections get", async () => {
    const { exitCode, stdout } = await cli("connections", "get", connectionId);
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.label).toBe("e2e-test");
  });

  test("connections set", async () => {
    const { exitCode, stdout } = await cli("connections", "set", connectionId, "-n", "e2e-renamed");
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.label).toBe("e2e-renamed");
  });

  test("connections delete", async () => {
    const { exitCode } = await cli("connections", "delete", connectionId);
    expect(exitCode).toBe(0);
  });

  test("connections get after delete returns 404", async () => {
    const { exitCode } = await cli("connections", "get", connectionId);
    expect(exitCode).toBe(1);
  });
});

describe("collections lifecycle", () => {
  let collectionId: string;

  test("collections list -f json", async () => {
    const { exitCode, stdout } = await cli("collections", "list", "-f", "json");
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toBeInstanceOf(Array);
  });

  test("collections create", async () => {
    const { exitCode, stdout } = await cli("collections", "create", "--display-name", "E2E Col");
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.displayName).toBe("E2E Col");
    collectionId = String(data.id);
  });

  test("collections get", async () => {
    const { exitCode, stdout } = await cli("collections", "get", collectionId);
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.displayName).toBeDefined();
  });

  test("collections set", async () => {
    const { exitCode, stdout } = await cli(
      "collections",
      "set",
      collectionId,
      "--display-name",
      "E2E Renamed",
    );
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.displayName).toBe("E2E Renamed");
  });

  test("collections delete", async () => {
    const { exitCode } = await cli("collections", "delete", collectionId);
    expect(exitCode).toBe(0);
  });

  test("collections get after delete returns 404", async () => {
    const { exitCode } = await cli("collections", "get", collectionId);
    expect(exitCode).toBe(1);
  });
});

describe("flows lifecycle", () => {
  let collectionAId: string;
  let collectionBId: string;
  let flowId: string;

  test("setup: create fixture collections", async () => {
    const resA = await cli("collections", "create", "--display-name", "E2E Flow Source");
    expect(resA.exitCode).toBe(0);
    collectionAId = String(JSON.parse(resA.stdout).id);

    const resB = await cli("collections", "create", "--display-name", "E2E Flow Target");
    expect(resB.exitCode).toBe(0);
    collectionBId = String(JSON.parse(resB.stdout).id);
  });

  test("flows list -f json", async () => {
    const { exitCode, stdout } = await cli("flows", "list", "-f", "json");
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toBeInstanceOf(Array);
  });

  test("flows create", async () => {
    const { exitCode, stdout } = await cli(
      "flows",
      "create",
      "--source-id",
      collectionAId,
      "--target-id",
      collectionBId,
    );
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.sourceId).toBeDefined();
    expect(data.targetId).toBeDefined();
    flowId = String(data.id);
  });

  test("flows get", async () => {
    const { exitCode } = await cli("flows", "get", flowId);
    expect(exitCode).toBe(0);
  });

  test("flows set --include-ref", async () => {
    const { exitCode, stdout } = await cli("flows", "set", flowId, "--include-ref");
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.includeRef).toBe(true);
  });

  test("flows delete", async () => {
    const { exitCode } = await cli("flows", "delete", flowId);
    expect(exitCode).toBe(0);
  });

  test("teardown: delete fixture collections", async () => {
    const resA = await cli("collections", "delete", collectionAId);
    expect(resA.exitCode).toBe(0);
    const resB = await cli("collections", "delete", collectionBId);
    expect(resB.exitCode).toBe(0);
  });
});

describe("status", () => {
  test("status -f json has expected keys", async () => {
    const { exitCode, stdout } = await cli("status", "-f", "json");
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data).toHaveProperty("connections");
    expect(data).toHaveProperty("collections");
    expect(data).toHaveProperty("flows");
  });
});

describe("error cases", () => {
  test("invalid command exits 1 with usage", async () => {
    const { exitCode, stderr } = await cli("bogus");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown command");
  });

  test("missing API key exits 1", async () => {
    const result = await $`node dist/main.js connections list`
      .env({ ...env, CONTFU_API_KEY: "", HOME: "/tmp/nonexistent" })
      .quiet()
      .nothrow();
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("No API key");
  });

  test("wrong API key exits 1", async () => {
    const result = await $`node dist/main.js connections list`
      .env({ ...env, CONTFU_API_KEY: "invalid-key" })
      .quiet()
      .nothrow();
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("Error");
  });
});
