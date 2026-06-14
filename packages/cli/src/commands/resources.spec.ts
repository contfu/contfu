import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
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
import { terminalLink, visibleWidth } from "../table";

const mockFetch = mock<typeof fetch>();
globalThis.fetch = mockFetch as any;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let logSpy: ReturnType<typeof spyOn>;
let errorSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  mockFetch.mockReset();
  process.env.CONTFU_API_KEY = "test-key";
  process.env.CONTFU_URL = "http://test.local";
  delete process.env.CONTFU_CLI_LINKS;
  delete process.env.NO_COLOR;
  logSpy = spyOn(console, "log").mockImplementation(() => {});
  errorSpy = spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
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
    expect(url).toBe("http://test.local/api/v1/integrations");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
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

    await list("integrations", "table");

    const calls: string[] = logSpy.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls[0]).toContain("ID");
    expect(calls[0]).toContain("Name");
    expect(calls[0]).toContain("Display Name");
    expect(calls.some((c) => c.includes("notionBrain"))).toBe(true);
    expect(calls.some((c) => c.includes("Notion Brain"))).toBe(true);
    expect(calls.some((c) => c.includes("\u001b]8;;http://test.local/integrations/conn_1"))).toBe(
      true,
    );
  });

  test("lists collections in table format with headers and row data", async () => {
    const data = [{ id: 5, name: "posts", displayName: "Posts", integrationId: 1 }];
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await list("collections", "table");

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe("http://test.local/api/v1/collections");
    const calls: string[] = logSpy.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls.some((c) => c.includes("Display Name"))).toBe(true);
    expect(calls.some((c) => c.includes("Posts"))).toBe(true);
    expect(calls.some((c) => c.includes("\u001b]8;;http://test.local/collections/5"))).toBe(true);
  });

  test("keeps collection table columns aligned when display names contain emoji", async () => {
    const data = [
      { id: "with_emoji", name: "media", displayName: "🖼️ Medien", integrationId: "conn_1" },
      { id: "plain", name: "pages", displayName: "Pages", integrationId: "conn_2" },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await list("collections", "table");

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
    const linked = terminalLink("YSsTjb", "http://test.local/collections/YSsTjb");
    expect(visibleWidth(linked)).toBe(6);
  });

  test("can disable terminal hyperlinks", () => {
    process.env.CONTFU_CLI_LINKS = "0";
    try {
      expect(terminalLink("YSsTjb", "http://test.local/collections/YSsTjb")).toBe("YSsTjb");
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
    expect(url).toBe("http://test.local/api/v1/integrations/1");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  test("fetches integration by name when the id is omitted", async () => {
    const data = { id: "conn_1", name: "Brain" };
    mockFetch.mockResolvedValueOnce(jsonResponse([data]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("integrations", "Brain");

    const url = (mockFetch.mock.calls[1] as unknown[])[0] as string;
    expect(url).toBe("http://test.local/api/v1/integrations/conn_1");
  });

  test("fetches collection by id", async () => {
    const data = { id: 5, displayName: "Posts" };
    mockFetch.mockResolvedValueOnce(jsonResponse([data]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("collections", "5");

    const url = (mockFetch.mock.calls[1] as unknown[])[0] as string;
    expect(url).toBe("http://test.local/api/v1/collections/5");
  });

  test("fetches collection by display name", async () => {
    const data = { id: "col_1", name: "posts", displayName: "Posts" };
    mockFetch.mockResolvedValueOnce(jsonResponse([data]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("collections", "Posts");

    const url = (mockFetch.mock.calls[1] as unknown[])[0] as string;
    expect(url).toBe("http://test.local/api/v1/collections/col_1");
  });

  test("fetches flow by id", async () => {
    const data = { id: 7, sourceId: 1, targetId: 2 };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("flows", "7");

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe("http://test.local/api/v1/flows/7");
  });
});

describe("create", () => {
  test("posts with raw json data", async () => {
    const data = { id: 1, name: "new" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("integrations", '{"label":"new"}', {});

    const [url, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/integrations");
    expect(opts.method).toBe("POST");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  test("posts with field flags", async () => {
    const data = { id: 2, label: "flagged" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("integrations", undefined, { name: "flagged" });

    const [url, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/integrations");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body as string)).toEqual({ name: "flagged", type: 20 });
  });

  test("posts integration scopes from scope flags for any provider", async () => {
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
    expect(url).toBe("http://test.local/api/v1/collections");
    expect(JSON.parse(opts.body as string)).toMatchObject({ displayName: "My Col" });
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
    expect(url).toBe("http://test.local/api/v1/collections");
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
});

describe("update", () => {
  test("updates collection with displayName", async () => {
    const data = { id: 5, displayName: "Renamed" };
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: 5, name: "posts", displayName: "Posts" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await update("collections", "5", undefined, { "display-name": "Renamed" });

    const [url, opts] = mockFetch.mock.calls[1] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/collections/5");
    expect(JSON.parse(opts.body as string)).toMatchObject({ displayName: "Renamed" });
  });

  test("patches with raw json data", async () => {
    const data = { id: 1, name: "updated" };
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: 1, name: "test" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await update("integrations", "1", '{"label":"updated"}', {});

    const [url, opts] = mockFetch.mock.calls[1] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/integrations/1");
    expect(opts.method).toBe("PATCH");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  test("patches with field flags", async () => {
    const data = { id: 1, label: "renamed" };
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: 1, name: "test" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await update("integrations", "1", undefined, { name: "renamed", scope: "staging" });

    const [url, opts] = mockFetch.mock.calls[1] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/integrations/1");
    expect(opts.method).toBe("PATCH");
    expect(JSON.parse(opts.body as string)).toEqual({ name: "renamed", scopes: ["staging"] });
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
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "col_1", schema: { locale: 2, slug: 2 } }));
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

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("must be one of --i18n-locales"));
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
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "col_1", schema: { tags: 4 } }));

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
    expect(url).toBe("http://test.local/api/v1/integrations/42");
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
