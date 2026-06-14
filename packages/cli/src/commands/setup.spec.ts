import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setup } from "./setup";

let cwd: string;
let previousCwd: string;
let logSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  previousCwd = process.cwd();
  cwd = mkdtempSync(join(tmpdir(), "contfu-setup-dry-run-"));
  writeFileSync(join(cwd, "package.json"), JSON.stringify({ dependencies: {} }));
  process.chdir(cwd);
  delete process.env.CONTFU_KEY;
  delete process.env.CONTFU_API_KEY;
  logSpy = spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  process.chdir(previousCwd);
  rmSync(cwd, { recursive: true, force: true });
});

describe("setup dry run", () => {
  test("reports package, app, env, and gitignore actions without writing files", async () => {
    await setup({
      package: "@contfu/client",
      appName: "Website",
      envFile: ".env.local",
      nonInteractive: true,
      dryRun: true,
    });

    const output = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("\n");
    expect(output).toContain("Dry run: would install package @contfu/client");
    expect(output).toContain("Dry run: would create or regenerate app integration key");
    expect(output).toContain("Dry run: would write CONTFU_KEY to env file");
    expect(output).toContain("Dry run: would ensure .gitignore contains .env");
    expect(existsSync(join(cwd, ".env.local"))).toBe(false);
    expect(existsSync(join(cwd, ".gitignore"))).toBe(false);
  });
});
