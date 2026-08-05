import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const cliPath = join(import.meta.dir, "main.ts");

async function runCli(args: string[], apiKey: string | null = "test-key") {
  const proc = Bun.spawn([process.execPath, cliPath, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      ...(apiKey === null ? { CONTFU_API_KEY: "" } : { CONTFU_API_KEY: apiKey }),
      HOME: "/tmp/contfu-cli-main-spec",
      NO_COLOR: "1",
    },
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

  test("advertises output formats and shortcuts", async () => {
    const result = await runCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("default (default) | agent | json");
    expect(result.stderr).not.toContain("-d, --default");
    expect(result.stderr).toContain("-a, --agent");
    expect(result.stderr).toContain("-j, --json");
    expect(result.stderr).toContain("-d, --data <json>");
  });

  test("maps output format shortcuts to agent and json", async () => {
    const defaultResult = await runCli(["status"], null);
    expect(defaultResult.exitCode).toBe(0);
    expect(defaultResult.stdout).toContain("Not authenticated. Run `contfu login`");

    const agentResult = await runCli(["status", "-a"], null);
    expect(agentResult.exitCode).toBe(0);
    expect(agentResult.stdout).toContain("authenticated: false");

    const jsonResult = await runCli(["status", "-j"], null);
    expect(jsonResult.exitCode).toBe(0);
    expect(JSON.parse(jsonResult.stdout)).toEqual({ authenticated: false });
  });

  test("accepts -d as the raw data shortcut", async () => {
    const result = await runCli([
      "integrations",
      "create",
      "-d",
      '{"name":"From data"}',
      "--dry-run",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain('"name": "From data"');
  });

  test("rejects the renamed table format before dispatch", async () => {
    const result = await runCli(["status", "--format", "table"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Unsupported output format: table");
    expect(result.stderr).toContain("Use default, agent, or json");
  });
});
