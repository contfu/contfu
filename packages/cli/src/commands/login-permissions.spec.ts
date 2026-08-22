import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const originalConfigDir = process.env.CONTFU_CONFIG_DIR;

afterEach(() => {
  if (originalConfigDir === undefined) delete process.env.CONTFU_CONFIG_DIR;
  else process.env.CONTFU_CONFIG_DIR = originalConfigDir;
});

describe("writeConfig permissions", () => {
  test("writes owner-only config and repairs permissive rewrites on POSIX", async () => {
    const configDir = await mkdtemp(join(tmpdir(), "contfu-cli-login-permissions-"));
    const moduleUrl = new URL("./login.ts", import.meta.url).href;
    const child = Bun.spawn(
      [
        "bun",
        "-e",
        `import { chmod, readFile, stat } from "node:fs/promises";
import { writeConfig } from "${moduleUrl}";
const path = process.env.CONTFU_CONFIG_DIR + "/config.json";
if (process.platform !== "win32") process.umask(0o022);
await writeConfig({ apiKey: "test-key", baseUrl: "https://contfu.com" });
const firstMode = process.platform === "win32" ? null : (await stat(path)).mode & 0o777;
if (process.platform !== "win32") await chmod(path, 0o644);
await writeConfig({ apiKey: "updated-key", baseUrl: "https://contfu.com" });
const secondMode = process.platform === "win32" ? null : (await stat(path)).mode & 0o777;
console.log(JSON.stringify({ firstMode, secondMode, content: await readFile(path, "utf8") }));`,
      ],
      {
        env: { ...process.env, CONTFU_CONFIG_DIR: configDir },
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    try {
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      if (exitCode !== 0) throw new Error(`child process failed (${exitCode}): ${stderr}`);
      const result = JSON.parse(stdout) as {
        firstMode: number | null;
        secondMode: number | null;
        content: string;
      };
      expect(result.content).toContain('"apiKey": "updated-key"');
      if (process.platform !== "win32") {
        expect(result.firstMode).toBe(0o600);
        expect(result.secondMode).toBe(0o600);
      }
    } finally {
      await rm(configDir, { recursive: true, force: true });
    }
  });
});
