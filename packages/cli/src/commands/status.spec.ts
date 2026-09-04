import { afterAll, afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { status } from "./status";

const mockFetch = mock<typeof fetch>();
globalThis.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(data: unknown, statusCode = 200): Response {
  return new Response(JSON.stringify(data), {
    status: statusCode,
    headers: { "Content-Type": "application/json" },
  });
}

const INTEGRATIONS = [
  {
    id: "1",
    name: "My Notion",
    type: 20,
    accountId: null,
    url: null,
    hasCredentials: true,
    createdAt: "2026-01-01",
    updatedAt: null,
  },
  {
    id: "2",
    name: "website",
    type: 0,
    accountId: null,
    url: null,
    hasCredentials: true,
    createdAt: "2026-01-01",
    updatedAt: null,
  },
];
const COLLECTIONS = [
  {
    id: "1",
    name: "blog",
    displayName: "Blog Posts",
    flowSourceCount: 1,
    flowTargetCount: 0,
    schema: null,
    hasRef: false,
    refString: null,
    integrationId: null,
    integrationName: null,
    integrationType: null,
    createdAt: "2026-01-01",
    updatedAt: null,
  },
];
const FLOWS = [
  {
    id: "1",
    sourceId: "10",
    targetId: "1",
    schema: null,
    mappings: null,
    filters: null,
    createdAt: "2026-01-01",
    updatedAt: null,
  },
];

let logSpy: ReturnType<typeof spyOn>;
let errorSpy: ReturnType<typeof spyOn>;
const originalApiKey = process.env.CONTFU_API_KEY;
const originalWorkspace = process.env.CONTFU_WORKSPACE;
const originalConfigDir = process.env.CONTFU_CONFIG_DIR;
const testConfigDir = await mkdtemp(join(tmpdir(), "contfu-cli-status-"));
process.env.CONTFU_CONFIG_DIR = testConfigDir;

beforeEach(async () => {
  mockFetch.mockReset();
  process.env.CONTFU_API_KEY = "test-key";
  delete process.env.CONTFU_WORKSPACE;
  await rm(join(testConfigDir, "config.json"), { force: true });
  logSpy = spyOn(console, "log").mockImplementation(() => {});
  errorSpy = spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
  if (originalApiKey === undefined) delete process.env.CONTFU_API_KEY;
  else process.env.CONTFU_API_KEY = originalApiKey;
  if (originalWorkspace === undefined) delete process.env.CONTFU_WORKSPACE;
  else process.env.CONTFU_WORKSPACE = originalWorkspace;
  process.env.CONTFU_CONFIG_DIR = testConfigDir;
  await rm(join(testConfigDir, "config.json"), { force: true });
});

afterAll(async () => {
  if (originalConfigDir === undefined) delete process.env.CONTFU_CONFIG_DIR;
  else process.env.CONTFU_CONFIG_DIR = originalConfigDir;
  await rm(testConfigDir, { recursive: true, force: true });
});

function mockApiResponses() {
  mockFetch.mockImplementation(((url: string) => {
    if (url.includes("/integrations")) return Promise.resolve(jsonResponse(INTEGRATIONS));
    if (url.includes("/collections")) return Promise.resolve(jsonResponse(COLLECTIONS));
    if (url.includes("/flows")) return Promise.resolve(jsonResponse(FLOWS));
    return Promise.resolve(jsonResponse({}, 404));
  }) as typeof fetch);
}

function requestUrls(): string[] {
  return mockFetch.mock.calls.map((call) => String((call as unknown[])[0]));
}

describe("status", () => {
  test("uses the stored workspace for every request", async () => {
    await writeFile(
      join(testConfigDir, "config.json"),
      JSON.stringify({ workspaceId: "workspace-a" }),
      "utf-8",
    );
    mockApiResponses();

    await status();

    expect(requestUrls()).toEqual([
      "https://contfu.com/api/v1/integrations?workspace=workspace-a",
      "https://contfu.com/api/v1/collections?workspace=workspace-a",
      "https://contfu.com/api/v1/flows?workspace=workspace-a",
    ]);
  });

  test("uses the explicit workspace over the stored workspace for every request", async () => {
    await writeFile(
      join(testConfigDir, "config.json"),
      JSON.stringify({ workspaceId: "workspace-a" }),
      "utf-8",
    );
    process.env.CONTFU_WORKSPACE = "workspace-b";
    mockApiResponses();

    await status();

    expect(requestUrls()).toEqual([
      "https://contfu.com/api/v1/integrations?workspace=workspace-b",
      "https://contfu.com/api/v1/collections?workspace=workspace-b",
      "https://contfu.com/api/v1/flows?workspace=workspace-b",
    ]);
  });

  test("fetches and prints table summary", async () => {
    mockApiResponses();
    await status();

    expect(mockFetch).toHaveBeenCalledTimes(3);
    const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join("\n");
    expect(output).toContain("contfu status");
    expect(output).toContain("Authenticated: yes");
    expect(output).toContain("My Notion");
    expect(output).toContain("notion");
    expect(output).toContain("Blog Posts");
    expect(output).toContain("1 flow(s)");
  });

  test("prints json when requested", async () => {
    mockApiResponses();
    await status("json");

    const output = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.authenticated).toBe(true);
    expect(parsed.integrations).toHaveLength(2);
    expect(parsed.integrations[0].typeLabel).toBe("notion");
    expect(parsed.integrations[1].typeLabel).toBe("application");
    expect(parsed.collections).toHaveLength(1);
    expect(parsed.flows).toHaveLength(1);
  });

  test("prints agent output when requested", async () => {
    mockApiResponses();
    await status("agent");

    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain("authenticated: true");
    expect(output).toContain("integrations[2]{");
    expect(output).toContain('",My Notion,notion,true');
    expect(output).not.toContain("createdAt");
    expect(output).not.toContain('"authenticated"');
  });

  test("includes all fields in full agent output", async () => {
    mockApiResponses();
    await status("agent", true);

    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain("createdAt");
    expect(output).toContain("typeLabel");
  });

  test("shows not authenticated when no key", async () => {
    delete process.env.CONTFU_API_KEY;
    await status();
    expect(logSpy).toHaveBeenCalledWith(
      "Not authenticated. Run `contfu login` or set CONTFU_API_KEY.",
    );
  });

  test("shows not authenticated json when no key", async () => {
    delete process.env.CONTFU_API_KEY;
    await status("json");
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.authenticated).toBe(false);
  });
});
