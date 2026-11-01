import { expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("rate-limited code exchange exits with recovery guidance and saves no credential", async () => {
  const configDir = await mkdtemp(join(tmpdir(), "contfu-login-rate-"));
  try {
    const child = Bun.spawn(
      [
        "bun",
        "--no-env-file",
        "-e",
        `globalThis.fetch = async () => new Response("private upstream message", { status: 429 });
const { login } = await import(${JSON.stringify(new URL("./login.ts", import.meta.url).href)});
try { await login({ noBrowser: true }); } catch (error) { console.error(error.message); process.exit(1); }`,
      ],
      {
        env: { ...process.env, CONTFU_CONFIG_DIR: configDir },
        stdin: "pipe",
        stdout: "ignore",
        stderr: "pipe",
      },
    );
    await child.stdin.write(`${"a".repeat(43)}.${"b".repeat(43)}\n`);
    await child.stdin.end();
    const stderr = await new Response(child.stderr).text();
    expect(await child.exited).toBe(1);
    expect(stderr).toContain("Wait 60 seconds without retrying");
    expect(stderr).not.toContain("private upstream message");
    expect(await readdir(configDir)).toEqual([]);
  } finally {
    await rm(configDir, { recursive: true, force: true });
  }
});
