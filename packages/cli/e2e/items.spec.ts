import { describe, test, expect } from "bun:test";
import { $ } from "bun";

const CLI_CWD = import.meta.dir + "/..";
const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:5173";

$.cwd(CLI_CWD);
$.nothrow();

async function cli(...args: string[]) {
  const result = await $`node dist/main.js ${args}`.quiet();
  return { exitCode: result.exitCode, stdout: result.text(), stderr: result.stderr.toString() };
}

describe("items query", () => {
  test("returns items with data and meta", async () => {
    const { exitCode, stdout } = await cli(
      "items",
      "query",
      "--client-url",
      CLIENT_URL,
      "--limit",
      "5",
    );
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("meta");
  });

  test("filters by collection", async () => {
    const { exitCode, stdout } = await cli(
      "items",
      "query",
      "--client-url",
      CLIENT_URL,
      "--collection",
      "blogPosts",
      "--limit",
      "2",
    );
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result).toHaveProperty("data");
  });

  test("missing --client-url exits 1", async () => {
    const { exitCode, stderr } = await cli("items", "query");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Missing required --client-url");
  });
});

describe("items count", () => {
  test("returns total count", async () => {
    const { exitCode, stdout } = await cli("items", "count", "--client-url", CLIENT_URL);
    expect(exitCode).toBe(0);
    const total = Number(stdout.trim());
    expect(total).toBeGreaterThanOrEqual(0);
  });

  test("missing --client-url exits 1", async () => {
    const { exitCode, stderr } = await cli("items", "count");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Missing required --client-url");
  });
});
