import { afterAll, afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { decode } from "@toon-format/toon";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const originalConfigDir = process.env.CONTFU_CONFIG_DIR;
const testConfigDir = await mkdtemp(join(tmpdir(), "contfu-cli-workspaces-"));
process.env.CONTFU_CONFIG_DIR = testConfigDir;

const originalFetch = globalThis.fetch;
const mockFetch = mock<typeof fetch>();
globalThis.fetch = mockFetch as any;

const { getWorkspace, inviteWorkspace, listWorkspaces, revokeWorkspaceMember, switchWorkspace } =
  await import("./workspaces");

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let logSpy: ReturnType<typeof spyOn>;
let errorSpy: ReturnType<typeof spyOn>;

beforeEach(async () => {
  await rm(join(testConfigDir, "config.json"), { force: true });
  mockFetch.mockReset();
  process.env.CONTFU_API_KEY = "test-key";
  delete process.env.CONTFU_WORKSPACE;
  delete process.env.CONTFU_CLI_LINKS;
  delete process.env.NO_COLOR;
  logSpy = spyOn(console, "log").mockImplementation(() => {});
  errorSpy = spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

afterAll(async () => {
  globalThis.fetch = originalFetch;
  delete process.env.CONTFU_WORKSPACE;
  if (originalConfigDir === undefined) delete process.env.CONTFU_CONFIG_DIR;
  else process.env.CONTFU_CONFIG_DIR = originalConfigDir;
  await rm(testConfigDir, { recursive: true, force: true });
});

describe("listWorkspaces", () => {
  test("prints display names and stable names", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        {
          id: "ws_1",
          displayName: "Default workspace",
          name: "defaultWorkspace",
          isDefault: true,
        },
      ]),
    );

    await listWorkspaces("default");

    const calls: string[] = logSpy.mock.calls.map((call: unknown[]) => String(call[0]));
    expect(calls[0]).toContain("ID");
    expect(calls[0]).toContain("Name");
    expect(calls[0]).toContain("Display Name");
    expect(calls.some((call) => call.includes("Default workspace"))).toBe(true);
    expect(calls.some((call) => call.includes("defaultWorkspace"))).toBe(true);
    expect(
      calls.some((call) => call.includes("\u001b]8;;https://contfu.com/workspaces/ws_1")),
    ).toBe(true);
  });

  test("prints compact agent rows by default", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        {
          id: "ws_1",
          displayName: "Default workspace",
          name: "defaultWorkspace",
          isDefault: true,
          isJoined: true,
          canManage: false,
          createdAt: "2026-01-01",
        },
      ]),
    );

    await listWorkspaces("agent");

    expect(logSpy.mock.calls[0][0]).toContain("id,name,displayName,isJoined,canManage,isDefault");
    expect(logSpy.mock.calls[0][0]).not.toContain("createdAt");
  });
});

describe("getWorkspace", () => {
  const workspace = {
    id: "ws_1",
    organizationId: "org_1",
    displayName: "Shared Space",
    name: "sharedSpace",
    organizationRole: 1,
    isDefault: false,
    isJoined: true,
    canManage: true,
    maxIntegrations: 10,
    createdAt: "2026-01-01",
    updatedAt: null,
  };

  test("presents organization roles in JSON", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([workspace]));

    await getWorkspace("ws_1", "json");

    expect(JSON.parse(logSpy.mock.calls[0][0] as string)).toMatchObject({
      id: "ws_1",
      organizationRole: "admin",
    });
  });

  test("uses compact agent detail output by default and expands with full", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([workspace]));
    await getWorkspace("ws_1", "agent");
    expect(decode(logSpy.mock.calls[0][0] as string)).toEqual({
      id: "ws_1",
      name: "sharedSpace",
      displayName: "Shared Space",
      organizationRole: "admin",
      isJoined: true,
      canManage: true,
      isDefault: false,
    });

    logSpy.mockClear();
    mockFetch.mockResolvedValueOnce(jsonResponse([workspace]));
    await getWorkspace("ws_1", "agent", true);
    expect(decode(logSpy.mock.calls[0][0] as string)).toMatchObject({
      maxIntegrations: 10,
      organizationRole: "admin",
    });
  });
});

describe("switchWorkspace", () => {
  test("resolves workspaces by display name", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        {
          id: "ws_1",
          displayName: "Shared Space",
          name: "sharedSpace",
          isDefault: false,
          isJoined: true,
        },
      ]),
    );

    await switchWorkspace("Shared Space");

    expect(logSpy).toHaveBeenCalledWith("Switched to workspace Shared Space (ws_1)");
  });

  test("rejects ambiguous workspace names", async () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        {
          id: "ws_1",
          displayName: "Shared Space",
          name: "sharedSpace",
          isDefault: false,
        },
        {
          id: "ws_2",
          displayName: "Shared Space",
          name: "sharedSpace",
          isDefault: false,
        },
      ]),
    );

    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(switchWorkspace("Shared Space")).rejects.toThrow("exit");
    expect(errorSpy).toHaveBeenCalledWith("Workspace name is ambiguous; use the workspace id");

    exitSpy.mockRestore();
  });
});

describe("revokeWorkspaceMember", () => {
  test("revokes workspace membership by email", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: "ws_1",
            displayName: "Shared Space",
            name: "sharedSpace",
            isDefault: false,
            isJoined: true,
          },
        ]),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await revokeWorkspaceMember("sharedSpace", "teammate+cli@example.com");

    expect(String(mockFetch.mock.calls[1][0])).toBe(
      "https://contfu.com/api/v1/workspaces/ws_1/members/teammate%2Bcli%40example.com",
    );
    expect(logSpy).toHaveBeenCalledWith("Workspace membership revoked");
  });
});

describe("dry run", () => {
  test("switch resolves workspace but does not write config", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([{ id: "ws_1", name: "main", displayName: "Main", isJoined: true }]),
    );

    await switchWorkspace("main", { dryRun: true });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("\n")).toContain(
      "Dry run: would persist selected workspace",
    );
  });

  test("invite resolves workspace but does not POST", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([{ id: "ws_1", name: "main", displayName: "Main", isJoined: true }]),
    );

    await inviteWorkspace("main", "a@example.com", { dryRun: true });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect((mockFetch.mock.calls[0] as unknown[])[1]).toMatchObject({ method: "GET" });
  });
});
