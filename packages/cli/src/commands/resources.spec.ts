import { afterAll, describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { decode } from "@toon-format/toon";
import { rm, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  list,
  get,
  create,
  update,
  del,
  isResource,
  listIntegrationTypes,
  resolveCollectionRef,
  resolveIntegrationRef,
} from "./resources";
import { PropertyType } from "@contfu/svc-api";
import { terminalLink, visibleWidth } from "../table";
import { getSelectedWorkspaceId } from "../http";

const mockFetch = mock<typeof fetch>();
globalThis.fetch = mockFetch as any;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function expectedApiUrl(path: string): string {
  const workspaceId = getSelectedWorkspaceId();
  return workspaceId
    ? `https://contfu.com${path}?workspace=${encodeURIComponent(workspaceId)}`
    : `https://contfu.com${path}`;
}

let logSpy: ReturnType<typeof spyOn>;
let errorSpy: ReturnType<typeof spyOn>;
const originalWorkspace = process.env.CONTFU_WORKSPACE;
const originalConfigDir = process.env.CONTFU_CONFIG_DIR;
const testConfigDir = await mkdtemp(join(tmpdir(), "contfu-cli-resources-"));
process.env.CONTFU_CONFIG_DIR = testConfigDir;

beforeEach(() => {
  mockFetch.mockReset();
  process.env.CONTFU_API_KEY = "test-key";
  delete process.env.CONTFU_WORKSPACE;
  delete process.env.CONTFU_CLI_LINKS;
  delete process.env.NO_COLOR;
  logSpy = spyOn(console, "log").mockImplementation(() => {});
  errorSpy = spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
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

describe("isResource", () => {
  test("returns true for valid resources", () => {
    expect(isResource("integrations")).toBe(true);
    expect(isResource("collections")).toBe(true);
    expect(isResource("flows")).toBe(true);
  });

  test("returns false for invalid resources", () => {
    expect(isResource("bogus")).toBe(false);
    expect(isResource("")).toBe(false);
    expect(isResource("sources")).toBe(false);
    expect(isResource("consumers")).toBe(false);
  });
});

describe("list", () => {
  test("fetches and prints resource list", async () => {
    const data = [{ id: 1, name: "test" }];
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await list("integrations", "json");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe(expectedApiUrl("/api/v1/integrations"));
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  test("prints resource list as agent output", async () => {
    const data = [{ id: 1, name: "test" }];
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await list("integrations", "agent");

    expect(logSpy).toHaveBeenCalledWith(
      "[1]{id,name,type,hasCredentials}:\n  1,test,undefined,null",
    );
  });

  test("uses compact agent rows unless full output is requested", async () => {
    const data = [
      {
        id: "conn_1",
        name: "notionBrain",
        type: 1,
        scopes: ["production"],
        hasCredentials: true,
        createdAt: "2026-01-01",
      },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse(data));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await list("integrations", "agent");
    await list("integrations", "agent", true);

    expect(logSpy.mock.calls[0][0]).toContain("type: web");
    expect(logSpy.mock.calls[0][0]).toContain("scopes[1]: production");
    expect(logSpy.mock.calls[0][0]).not.toContain("createdAt");
    expect(logSpy.mock.calls[1][0]).toContain("createdAt");
  });

  test("lists integrations with stable and display name columns", async () => {
    const data = [
      {
        id: "conn_1",
        name: "notionBrain",
        displayName: "Notion Brain",
        type: 1,
        accountId: null,
        hasCredentials: true,
      },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await list("integrations", "default");

    const calls: string[] = logSpy.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls[0]).toContain("ID");
    expect(calls[0]).toContain("Name");
    expect(calls[0]).toContain("Display Name");
    expect(calls.some((c) => c.includes("notionBrain"))).toBe(true);
    expect(calls.some((c) => c.includes("Notion Brain"))).toBe(true);
    expect(calls.some((c) => c.includes("\u001b]8;;https://contfu.com/integrations/conn_1"))).toBe(
      true,
    );
  });

  test("lists collections in table format with headers and row data", async () => {
    const data = [{ id: 5, name: "posts", displayName: "Posts", integrationId: 1 }];
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await list("collections", "default");

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe(expectedApiUrl("/api/v1/collections"));
    const calls: string[] = logSpy.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls.some((c) => c.includes("Display Name"))).toBe(true);
    expect(calls.some((c) => c.includes("Posts"))).toBe(true);
    expect(calls.some((c) => c.includes("\u001b]8;;https://contfu.com/collections/5"))).toBe(true);
  });

  test("keeps collection table columns aligned when display names contain emoji", async () => {
    const data = [
      { id: "with_emoji", name: "media", displayName: "🖼️ Medien", integrationId: "conn_1" },
      { id: "plain", name: "pages", displayName: "Pages", integrationId: "conn_2" },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await list("collections", "default");

    const calls: string[] = logSpy.mock.calls.map((c: unknown[]) => c[0] as string);
    const emojiRow = calls.find((c) => c.includes("with_emoji"))!;
    const plainRow = calls.find((c) => c.includes("plain"))!;
    const emojiIntegrationStart = visibleWidth(emojiRow.slice(0, emojiRow.indexOf("conn_1")));
    const plainIntegrationStart = visibleWidth(plainRow.slice(0, plainRow.indexOf("conn_2")));
    expect(emojiIntegrationStart).toBe(plainIntegrationStart);
  });
});

describe("table width", () => {
  test("treats emoji presentation clusters as narrow by default", () => {
    expect(visibleWidth("❤️ Empfehlungen")).toBe(14);
    expect(visibleWidth("🖼️ Medien")).toBe(8);
  });

  test("allows wide emoji terminals to opt in", () => {
    process.env.CONTFU_CLI_EMOJI_WIDTH = "2";
    try {
      expect(visibleWidth("❤️ Empfehlungen")).toBe(15);
      expect(visibleWidth("🖼️ Medien")).toBe(9);
    } finally {
      delete process.env.CONTFU_CLI_EMOJI_WIDTH;
    }
  });

  test("ignores terminal hyperlink escape sequences in visible width", () => {
    const linked = terminalLink("YSsTjb", "https://contfu.com/collections/YSsTjb");
    expect(visibleWidth(linked)).toBe(6);
  });

  test("can disable terminal hyperlinks", () => {
    process.env.CONTFU_CLI_LINKS = "0";
    try {
      expect(terminalLink("YSsTjb", "https://contfu.com/collections/YSsTjb")).toBe("YSsTjb");
    } finally {
      delete process.env.CONTFU_CLI_LINKS;
    }
  });
});

describe("get", () => {
  test("fetches and prints single resource", async () => {
    const data = { id: 1, name: "test" };
    mockFetch.mockResolvedValueOnce(jsonResponse([data]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("integrations", "1");

    const url = (mockFetch.mock.calls[1] as unknown[])[0] as string;
    expect(url).toBe(expectedApiUrl("/api/v1/integrations/1"));
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  test("fetches integration by name when the id is omitted", async () => {
    const data = { id: "conn_1", name: "Brain" };
    mockFetch.mockResolvedValueOnce(jsonResponse([data]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("integrations", "Brain");

    const url = (mockFetch.mock.calls[1] as unknown[])[0] as string;
    expect(url).toBe(expectedApiUrl("/api/v1/integrations/conn_1"));
  });

  test("uses the explicitly selected workspace for resource retrieval", async () => {
    process.env.CONTFU_WORKSPACE = "workspace-b";
    const data = { id: "conn_1", name: "Brain" };
    mockFetch.mockResolvedValueOnce(jsonResponse([data]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("integrations", "Brain");

    expect((mockFetch.mock.calls[0] as unknown[])[0]).toBe(
      "https://contfu.com/api/v1/integrations?workspace=workspace-b",
    );
    expect((mockFetch.mock.calls[1] as unknown[])[0]).toBe(
      "https://contfu.com/api/v1/integrations/conn_1?workspace=workspace-b",
    );
  });

  test("uses the stored workspace when no explicit option is supplied", async () => {
    process.env.CONTFU_CONFIG_DIR = testConfigDir;
    await writeFile(
      join(testConfigDir, "config.json"),
      JSON.stringify({ workspaceId: "workspace-a" }),
      "utf-8",
    );
    const data = { id: "conn_1", name: "Brain" };
    mockFetch.mockResolvedValueOnce(jsonResponse([data]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("integrations", "Brain");

    expect((mockFetch.mock.calls[0] as unknown[])[0]).toBe(
      "https://contfu.com/api/v1/integrations?workspace=workspace-a",
    );
    expect((mockFetch.mock.calls[1] as unknown[])[0]).toBe(
      "https://contfu.com/api/v1/integrations/conn_1?workspace=workspace-a",
    );
  });

  test("fetches collection by id", async () => {
    const data = { id: 5, displayName: "Posts" };
    mockFetch.mockResolvedValueOnce(jsonResponse([data]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("collections", "5");

    const url = (mockFetch.mock.calls[1] as unknown[])[0] as string;
    expect(url).toBe(expectedApiUrl("/api/v1/collections/5"));
  });

  test("fetches collection by display name", async () => {
    const data = { id: "col_1", name: "posts", displayName: "Posts" };
    mockFetch.mockResolvedValueOnce(jsonResponse([data]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("collections", "Posts");

    const url = (mockFetch.mock.calls[1] as unknown[])[0] as string;
    expect(url).toBe(expectedApiUrl("/api/v1/collections/col_1"));
  });

  test("fetches flow by id", async () => {
    const data = { id: 7, sourceId: 1, targetId: 2 };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("flows", "7");

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe(expectedApiUrl("/api/v1/flows/7"));
  });

  test("presents flow enums in JSON and TOON detail output", async () => {
    const data = {
      id: "flow_1",
      sourceId: "src_1",
      targetId: "dst_1",
      state: 1,
      schema: null,
      mappings: null,
      filters: null,
      sourceIntegrationType: 20,
      targetIntegrationType: null,
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("flows", "flow_1", "json");
    expect(JSON.parse(logSpy.mock.calls[0][0] as string)).toMatchObject({
      state: "frozen",
      sourceIntegrationType: "notion",
      targetIntegrationType: null,
    });

    logSpy.mockClear();
    mockFetch.mockResolvedValueOnce(jsonResponse(data));
    await get("flows", "flow_1", "agent", true);
    expect(decode(logSpy.mock.calls[0][0] as string)).toMatchObject({
      state: "frozen",
      sourceIntegrationType: "notion",
      targetIntegrationType: null,
    });
  });

  test("prints integration details as symbolic compact agent output", async () => {
    const data = {
      id: "conn_1",
      name: "Notion",
      type: 20,
      mode: 3,
      roles: [1, 2],
      capabilities: {
        supported: [1],
        granted: [1],
        enabled: [1, 4],
        disabledReasons: { 5: "not granted" },
      },
      scopes: ["production"],
      hasCredentials: true,
      createdAt: "2026-01-01",
    };
    mockFetch.mockResolvedValueOnce(jsonResponse([data]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("integrations", "conn_1", "agent");

    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain("type: notion");
    expect(output).toContain("mode[2]: poll,webhook");
    expect(output).toContain("roles[2]: source,target");
    expect(output).toContain("capabilities[2]: component-discovery,content-provide");
    expect(output).not.toContain("supported");
    expect(output).not.toContain("granted");
    expect(output).not.toContain("createdAt");
  });

  test("prints integration detail labels in JSON", async () => {
    const data = {
      id: "conn_1",
      name: "Notion",
      type: 20,
      mode: 3,
      roles: [1, 2],
      capabilities: { enabled: [1, 4] },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse([data]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("integrations", "conn_1", "json");

    expect(JSON.parse(logSpy.mock.calls[0][0] as string)).toMatchObject({
      type: "notion",
      mode: ["poll", "webhook"],
      roles: ["source", "target"],
      capabilities: ["component-discovery", "content-provide"],
    });
  });

  test("keeps readable collection schema in default detail output", async () => {
    const data = {
      id: "col_1",
      name: "posts",
      displayName: "Posts",
      schema: { title: PropertyType.STRING },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse([data]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("collections", "col_1");

    expect(JSON.parse(logSpy.mock.calls[0][0] as string).schema).toEqual({ title: "string" });
  });

  test("prints collection details as symbolic full agent output", async () => {
    const data = {
      id: "col_1",
      name: "posts",
      displayName: "Posts",
      integrationId: "conn_1",
      integrationType: 20,
      sourceSyncStatus: 3,
      stale: true,
      staleReason: 1,
      schema: { title: PropertyType.STRING },
      createdAt: "2026-01-01",
    };
    mockFetch.mockResolvedValueOnce(jsonResponse([data]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("collections", "col_1", "agent", true);

    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain("integrationType: notion");
    expect(output).toContain("sourceSyncStatus: needs-full-pull");
    expect(output).toContain("staleReason: quota-blocked");
    expect(output).toContain("createdAt");
    expect(output).toContain("schema:");
  });

  test("uses a stable fallback for unknown agent enum values", async () => {
    const data = {
      id: "conn_unknown",
      name: "Unknown",
      type: 999,
      mode: 4,
      roles: [999],
      capabilities: { enabled: [999] },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse([data]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("integrations", "conn_unknown", "agent", true);

    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain("type: unknown(999)");
    expect(output).toContain("mode[1]: unknown(4)");
    expect(output).toContain("roles[1]: unknown(999)");
    expect(output).toContain("capabilities[1]: unknown(999)");
  });
});

describe("create", () => {
  test("posts with raw json data", async () => {
    const data = { id: 1, name: "new" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("integrations", '{"label":"new"}', {});

    const [url, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(url).toBe(expectedApiUrl("/api/v1/integrations"));
    expect(opts.method).toBe("POST");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  test("posts with field flags", async () => {
    const data = { id: 2, label: "flagged" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("integrations", undefined, { name: "flagged" });

    const [url, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(url).toBe(expectedApiUrl("/api/v1/integrations"));
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body as string)).toEqual({ name: "flagged", type: 20 });
  });

  test("posts integration scopes from scope flags for any service", async () => {
    const data = { id: 2, label: "flagged" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("integrations", undefined, {
      name: "flagged",
      type: "contentful",
      scopes: "master,staging",
    });

    const [, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toMatchObject({ scopes: ["master", "staging"] });
  });

  test("posts webhook target options from webhook flags", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 2, label: "webhook" }));

    await create("integrations", undefined, {
      name: "Search webhook",
      type: "webhook",
      url: "https://example.com/{itemId}",
      "webhook-header": "X-Index=search,X-Env=prod",
      "webhook-max-attempts": "3",
      "webhook-delivery-window": "25",
    });

    const [, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toEqual({
      name: "Search webhook",
      type: 2,
      url: "https://example.com/{itemId}",
      opts: {
        headers: { "X-Index": "search", "X-Env": "prod" },
        maxAttempts: 3,
        deliveryWindow: 25,
      },
    });
  });

  test("maps Contentful --url to persisted space options", async () => {
    const data = { id: 2, label: "contentful" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("integrations", undefined, {
      name: "Contentful",
      type: "contentful",
      url: "space_123",
      token: "delivery-token",
      scope: "staging",
    });

    const [, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toEqual({
      name: "Contentful",
      type: 22,
      url: null,
      credentials: "delivery-token",
      scopes: ["staging"],
      opts: { spaceId: "space_123" },
    });
  });

  test("creates Contentful preview integrations with explicit preview credentials", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "cf_1", name: "Preview" }));

    await create("integrations", undefined, {
      name: "Preview",
      type: "contentful",
      url: "space_123",
      scope: "preview-env",
      "contentful-api-mode": "preview",
      "contentful-delivery-token": "delivery-token",
      "contentful-preview-token": "preview-token",
    });

    const [, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toEqual({
      name: "Preview",
      type: 22,
      url: null,
      credentials: JSON.stringify({
        deliveryToken: "delivery-token",
        previewToken: "preview-token",
      }),
      scopes: ["preview-env"],
      opts: { apiMode: "preview", spaceId: "space_123" },
    });
  });

  test("creates WordPress integrations with application password credentials and draft mode", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "wp_1", name: "Site" }));

    await create("integrations", undefined, {
      name: "Site",
      type: "wordpress",
      url: "https://example.com",
      username: "editor",
      "application-password": "app pass",
      "include-drafts": true,
    });

    const [, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toEqual({
      name: "Site",
      type: 23,
      url: "https://example.com",
      credentials: Buffer.from("editor:app pass", "utf-8").toString("base64"),
      opts: { includeDrafts: true },
    });
  });

  test("rejects conflicting integration credential flags", async () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });

    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(
      create("integrations", undefined, {
        name: "Site",
        type: "wordpress",
        token: "token",
        username: "editor",
        "application-password": "app pass",
      }),
    ).rejects.toThrow("exit");

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Use either --token"));
    expect(mockFetch).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  test.each(["storyblok", "prismic"])("rejects unavailable integration type %s", async (type) => {
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });

    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(create("integrations", undefined, { name: "Unavailable", type })).rejects.toThrow(
      "exit",
    );

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("not currently available"));
    expect(mockFetch).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  test("rejects unknown integration types", async () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });

    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(
      create("integrations", undefined, { name: "Mystery", type: "strapii" }),
    ).rejects.toThrow("exit");

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Unknown integration type"));
    expect(mockFetch).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  test("exits with error when required flags missing", async () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });
    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(create("collections", undefined, {})).rejects.toThrow("exit");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("--display-name"));
    exitSpy.mockRestore();
  });

  test("creates collection with displayName from --display-name", async () => {
    const data = { id: 5, displayName: "My Col" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("collections", undefined, { "display-name": "My Col" });

    const [url, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(url).toBe(expectedApiUrl("/api/v1/collections"));
    expect(JSON.parse(opts.body as string)).toMatchObject({ displayName: "My Col" });
  });

  test("creates collection with rich content disabled", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 5, displayName: "Props Only" }));

    await create("collections", undefined, { "display-name": "Props Only", "no-content": true });

    const [, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toMatchObject({
      displayName: "Props Only",
      includeContent: false,
    });
  });

  test("rejects conflicting collection content flags", async () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });

    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(
      create("collections", undefined, {
        "display-name": "My Col",
        content: true,
        "no-content": true,
      }),
    ).rejects.toThrow("exit");

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("--content or --no-content"));
    expect(mockFetch).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  test("creates collection with integration name resolved to id", async () => {
    const data = { id: "col_1", displayName: "My Col", integrationId: "conn_1" };
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "conn_1", name: "Brain" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("collections", undefined, {
      "display-name": "My Col",
      "integration-id": "Brain",
    });

    const [url, opts] = mockFetch.mock.calls[1] as unknown[] as [string, RequestInit];
    expect(url).toBe(expectedApiUrl("/api/v1/collections"));
    expect(JSON.parse(opts.body as string)).toMatchObject({
      displayName: "My Col",
      integrationId: "conn_1",
    });
  });

  test("creates flow with sourceId/targetId as strings", async () => {
    const data = { id: "1", sourceId: "3", targetId: "4" };
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { id: "3", name: "source", displayName: "Source" },
        { id: "4", name: "target", displayName: "Target" },
      ]),
    );
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("flows", undefined, { "source-id": "3", "target-id": "4" });

    const [, opts] = mockFetch.mock.calls[1] as unknown[] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.sourceId).toBe("3");
    expect(body.targetId).toBe("4");
    expect(typeof body.sourceId).toBe("string");
    expect(typeof body.targetId).toBe("string");
  });

  test("creates flow with collection names resolved to ids", async () => {
    const data = { id: "flow_1", sourceId: "src_1", targetId: "dst_1" };
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { id: "src_1", name: "source", displayName: "Source" },
        { id: "dst_1", name: "target", displayName: "Target" },
      ]),
    );
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("flows", undefined, { "source-id": "Source", "target-id": "Target" });

    const [, opts] = mockFetch.mock.calls[1] as unknown[] as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toMatchObject({
      sourceId: "src_1",
      targetId: "dst_1",
    });
  });

  test("merges flow flags into raw json data", async () => {
    const data = { id: "flow_1", sourceId: "src_1", targetId: "dst_1" };
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { id: "src_1", name: "source", displayName: "Source" },
        { id: "dst_1", name: "target", displayName: "Target" },
      ]),
    );
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("flows", '{"mappings":[{"source":"title","target":"headline"}]}', {
      "source-id": "Source",
      "target-id": "Target",
    });

    const [, opts] = mockFetch.mock.calls[1] as unknown[] as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toEqual({
      mappings: [{ source: "title", target: "headline" }],
      sourceId: "src_1",
      targetId: "dst_1",
    });
  });

  test("keeps complete raw flow json data as the API body", async () => {
    const data = { id: "flow_1", sourceId: "src_1", targetId: "dst_1" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("flows", '{"sourceId":"src_1","targetId":"dst_1","filters":[]}', {});

    const [, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toEqual({
      sourceId: "src_1",
      targetId: "dst_1",
      filters: [],
    });
  });
});

describe("update", () => {
  test("updates collection with displayName", async () => {
    const data = { id: 5, displayName: "Renamed" };
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: 5, name: "posts", displayName: "Posts" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await update("collections", "5", undefined, { "display-name": "Renamed" });

    const [url, opts] = mockFetch.mock.calls[1] as unknown[] as [string, RequestInit];
    expect(url).toBe(expectedApiUrl("/api/v1/collections/5"));
    expect(JSON.parse(opts.body as string)).toMatchObject({ displayName: "Renamed" });
  });

  test("updates collection rich content setting", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: 5, name: "posts", displayName: "Posts" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 5, displayName: "Posts" }));

    await update("collections", "5", undefined, { content: true });

    const [, opts] = mockFetch.mock.calls[1] as unknown[] as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toEqual({ includeContent: true });
  });

  test("patches with raw json data", async () => {
    const data = { id: 1, name: "updated" };
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: 1, name: "test" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await update("integrations", "1", '{"label":"updated"}', {});

    const [url, opts] = mockFetch.mock.calls[1] as unknown[] as [string, RequestInit];
    expect(url).toBe(expectedApiUrl("/api/v1/integrations/1"));
    expect(opts.method).toBe("PATCH");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  test("patches with field flags", async () => {
    const data = { id: 1, label: "renamed" };
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: 1, name: "test" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await update("integrations", "1", undefined, { name: "renamed", scope: "staging" });

    const [url, opts] = mockFetch.mock.calls[1] as unknown[] as [string, RequestInit];
    expect(url).toBe(expectedApiUrl("/api/v1/integrations/1"));
    expect(opts.method).toBe("PATCH");
    expect(JSON.parse(opts.body as string)).toEqual({ name: "renamed", scopes: ["staging"] });
  });

  test("updates integration credentials from secret flags", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "conn_1", name: "Contentful" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "conn_1", hasCredentials: true }));

    await update("integrations", "Contentful", undefined, {
      token: "new-token",
      "webhook-secret": "new-webhook-secret",
    });

    const [url, opts] = mockFetch.mock.calls[1] as unknown[] as [string, RequestInit];
    expect(url).toBe(expectedApiUrl("/api/v1/integrations/conn_1"));
    expect(opts.method).toBe("PATCH");
    expect(JSON.parse(opts.body as string)).toEqual({
      credentials: "new-token",
      webhookSecret: "new-webhook-secret",
    });
  });

  test("updates integration draft mode without clearing other service options", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "wp_1", name: "Site" }]));
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: "wp_1", opts: { graphqlAvailable: true, includeDrafts: true } }),
    );
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "wp_1" }));

    await update("integrations", "Site", undefined, { "no-include-drafts": true });

    const [url, opts] = mockFetch.mock.calls[2] as unknown[] as [string, RequestInit];
    expect(url).toBe(expectedApiUrl("/api/v1/integrations/wp_1"));
    expect(opts.method).toBe("PATCH");
    expect(JSON.parse(opts.body as string)).toEqual({
      opts: { graphqlAvailable: true, includeDrafts: false },
    });
  });

  test("updates Contentful API mode without clearing persisted space options", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "cf_1", name: "Contentful" }]));
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: "cf_1", opts: { spaceId: "space_123", apiMode: "delivery" } }),
    );
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "cf_1" }));

    await update("integrations", "Contentful", undefined, {
      "contentful-api-mode": "preview",
      "contentful-preview-token": "preview-token",
    });

    const [url, opts] = mockFetch.mock.calls[2] as unknown[] as [string, RequestInit];
    expect(url).toBe(expectedApiUrl("/api/v1/integrations/cf_1"));
    expect(opts.method).toBe("PATCH");
    expect(JSON.parse(opts.body as string)).toEqual({
      credentials: JSON.stringify({ previewToken: "preview-token" }),
      opts: { spaceId: "space_123", apiMode: "preview" },
    });
  });

  test("configures integration i18n active locales and locale map", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "app_1", name: "App" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "app_1" }));

    await update("integrations", "App", undefined, {
      "i18n-locales": "en,de-DE",
      "i18n-active-locales": "custom:en,de-de",
      "i18n-locale-map": "English=en,German=de-DE",
    });

    const [, opts] = mockFetch.mock.calls[1] as unknown[] as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toEqual({
      i18n: {
        locales: ["en", "de-DE"],
        activeLocales: { mode: "custom", locales: ["en", "de-DE"] },
        localeMap: { English: "en", German: "de-DE" },
      },
    });
  });

  test("resets integration user i18n layer", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "app_1", name: "App" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "app_1" }));

    await update("integrations", "App", undefined, { "reset-i18n": true });

    const [, opts] = mockFetch.mock.calls[1] as unknown[] as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toEqual({
      i18n: { activeLocales: { mode: "inherit" } },
    });
  });

  test("configures collection manual localization", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([{ id: "col_1", name: "posts", displayName: "Posts" }]),
    );
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        id: "col_1",
        schema: { locale: PropertyType.STRING, slug: PropertyType.STRING },
      }),
    );
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "col_1" }));

    await update("collections", "Posts", undefined, {
      "i18n-locale-field": "locale",
      "i18n-locale-map": "English=en",
      "i18n-keep-raw-field": true,
      "i18n-grouping-key": "slug",
    });

    const [, opts] = mockFetch.mock.calls[2] as unknown[] as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toEqual({
      i18n: {
        localeField: "locale",
        localeMap: { English: "en" },
        keepLocaleField: true,
        key: "slug",
      },
    });
  });

  test("rejects invalid locale map values", async () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "app_1", name: "App" }]));

    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(
      update("integrations", "App", undefined, { "i18n-locale-map": "English=not_a_locale" }),
    ).rejects.toThrow("exit");

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("invalid BCP 47 locale"));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    exitSpy.mockRestore();
  });

  test("rejects integration locale map values outside configured locales", async () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "app_1", name: "App" }]));

    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(
      update("integrations", "App", undefined, {
        "i18n-locales": "en,de",
        "i18n-locale-map": "French=fr",
      }),
    ).rejects.toThrow("exit");

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("must be one of active locales"));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    exitSpy.mockRestore();
  });

  test("rejects integration locale map values outside custom active locales", async () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "app_1", name: "App" }]));

    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(
      update("integrations", "App", undefined, {
        "i18n-locales": "en,fr",
        "i18n-active-locales": "custom:en",
        "i18n-locale-map": "French=fr",
      }),
    ).rejects.toThrow("exit");

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("must be one of active locales"));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    exitSpy.mockRestore();
  });

  test("rejects system collection grouping keys", async () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });
    mockFetch.mockResolvedValueOnce(
      jsonResponse([{ id: "col_1", name: "posts", displayName: "Posts" }]),
    );

    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(
      update("collections", "Posts", undefined, { "i18n-grouping-key": "$locale" }),
    ).rejects.toThrow("exit");

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("normal collection property"));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    exitSpy.mockRestore();
  });

  test("rejects non-scalar collection grouping key", async () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });
    mockFetch.mockResolvedValueOnce(
      jsonResponse([{ id: "col_1", name: "posts", displayName: "Posts" }]),
    );
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: "col_1", schema: { tags: PropertyType.STRINGS } }),
    );

    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(
      update("collections", "Posts", undefined, { "i18n-grouping-key": "tags" }),
    ).rejects.toThrow("exit");

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Fallback Grouping Key must be a scalar"),
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);
    exitSpy.mockRestore();
  });
});

describe("del", () => {
  test("deletes and prints confirmation", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: 42, name: "test" }]));
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await del("integrations", "42");

    const [url, opts] = mockFetch.mock.calls[1] as unknown[] as [string, RequestInit];
    expect(url).toBe(expectedApiUrl("/api/v1/integrations/42"));
    expect(opts.method).toBe("DELETE");
    expect(logSpy).toHaveBeenCalledWith("Deleted integration 42");
  });

  test("deletes collection and prints confirmation", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: 5, name: "posts", displayName: "Posts" }]));
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await del("collections", "5");

    expect(logSpy).toHaveBeenCalledWith("Deleted collection 5");
  });

  test("deletes flow and prints confirmation", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await del("flows", "12");

    expect(logSpy).toHaveBeenCalledWith("Deleted flow 12");
  });
});

describe("resource reference resolution", () => {
  test("prefers integration id before matching names", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { id: "same", name: "By ID" },
        { id: "conn_2", name: "same" },
      ]),
    );

    // oxlint-disable-next-line typescript/await-thenable -- bun:test .resolves returns a Promise at runtime but types lack Thenable
    await expect(resolveIntegrationRef("same")).resolves.toBe("same");
  });

  test("rejects ambiguous integration names", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { id: "conn_1", name: "Brain" },
        { id: "conn_2", name: "Brain" },
      ]),
    );

    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(resolveIntegrationRef("Brain")).rejects.toThrow(
      "Integration name is ambiguous; use the Integration id",
    );
  });

  test("resolves collection by stable name or display name", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([{ id: "col_1", name: "posts", displayName: "Posts" }]),
    );

    // oxlint-disable-next-line typescript/await-thenable -- bun:test .resolves returns a Promise at runtime but types lack Thenable
    await expect(resolveCollectionRef("posts")).resolves.toBe("col_1");

    mockFetch.mockResolvedValueOnce(
      jsonResponse([{ id: "col_1", name: "posts", displayName: "Posts" }]),
    );

    // oxlint-disable-next-line typescript/await-thenable -- bun:test .resolves returns a Promise at runtime but types lack Thenable
    await expect(resolveCollectionRef("Posts")).resolves.toBe("col_1");
  });
});

describe("listIntegrationTypes", () => {
  test("writes integration type groups separated by blank line", () => {
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    listIntegrationTypes();

    const written = (writeSpy.mock.calls as unknown[][]).map((c) => c[0] as string).join("");
    writeSpy.mockRestore();
    // custom types (app, web) come before services (contentful, notion, strapi)
    expect(written).toContain("app");
    expect(written).toContain("notion");
    expect(written).toContain("strapi");
    expect(written).not.toContain("storyblok");
    expect(written).not.toContain("prismic");
    // blank line separator between groups
    expect(written).toContain("\n\n");
  });
});

describe("dry run", () => {
  test("create integration does not POST and redacts secrets", async () => {
    await create(
      "integrations",
      undefined,
      { name: "Notion", token: "secret-token", "webhook-secret": "hook-secret" },
      undefined,
      { dryRun: true },
    );

    expect(mockFetch).not.toHaveBeenCalled();
    const output = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("\n");
    expect(output).toContain("Dry run: would create integration");
    expect(output).toContain("[redacted]");
    expect(output).not.toContain("secret-token");
    expect(output).not.toContain("hook-secret");
  });

  test("delete integration resolves by GET but does not DELETE", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "int_1", name: "Notion" }]));

    await del("integrations", "Notion", { dryRun: true });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect((mockFetch.mock.calls[0] as unknown[])[1]).toMatchObject({ method: "GET" });
    expect(logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("\n")).toContain(
      "Dry run: would delete integration",
    );
  });
});
