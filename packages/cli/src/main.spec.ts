import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const cliPath = join(import.meta.dir, "main.ts");

async function runCli(args: string[]) {
  const proc = Bun.spawn([process.execPath, cliPath, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, CONTFU_API_KEY: "test-key", NO_COLOR: "1" },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

describe("cli main", () => {
  test("forwards WordPress credential and draft flags to resource commands", async () => {
    const result = await runCli([
      "integrations",
      "create",
      "--name",
      "Site",
      "--type",
      "wordpress",
      "--url",
      "https://example.com",
      "--username",
      "editor",
      "--application-password",
      "app pass",
      "--include-drafts",
      "--dry-run",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain('"credentials": "[redacted]"');
    expect(result.stdout).toContain('"includeDrafts": true');
  });

  test("forwards Contentful preview mode flags to resource commands", async () => {
    const result = await runCli([
      "integrations",
      "create",
      "--name",
      "Preview",
      "--type",
      "contentful",
      "--url",
      "space_123",
      "--scope",
      "staging",
      "--contentful-api-mode",
      "preview",
      "--contentful-preview-token",
      "preview-token",
      "--dry-run",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain('"apiMode": "preview"');
    expect(result.stdout).toContain('"credentials": "[redacted]"');
  });

  test("forwards dry-run to organization invite acceptance", async () => {
    const result = await runCli(["orgs", "accept", "invite-token", "--dry-run"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Dry run: would accept organization invitation");
    expect(result.stdout).toContain('"token": "[redacted]"');
  });
});
