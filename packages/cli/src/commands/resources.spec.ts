import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import {
  list,
  get,
  create,
  update,
  del,
  isResource,
  listConnectionTypes,
  resolveCollectionRef,
  resolveConnectionRef,
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
    expect(isResource("connections")).toBe(true);
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

    await list("connections", "json");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe("http://test.local/api/v1/connections");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  test("lists connections with stable and display name columns", async () => {
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

    await list("connections", "table");

    const calls: string[] = logSpy.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls[0]).toContain("ID");
    expect(calls[0]).toContain("Name");
    expect(calls[0]).toContain("Display Name");
    expect(calls.some((c) => c.includes("notionBrain"))).toBe(true);
    expect(calls.some((c) => c.includes("Notion Brain"))).toBe(true);
    expect(calls.some((c) => c.includes("\u001b]8;;http://test.local/connections/conn_1"))).toBe(
      true,
    );
  });

  test("lists collections in table format with headers and row data", async () => {
    const data = [{ id: 5, name: "posts", displayName: "Posts", connectionId: 1 }];
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
      { id: "with_emoji", name: "media", displayName: "🖼️ Medien", connectionId: "conn_1" },
      { id: "plain", name: "pages", displayName: "Pages", connectionId: "conn_2" },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await list("collections", "table");

    const calls: string[] = logSpy.mock.calls.map((c: unknown[]) => c[0] as string);
    const emojiRow = calls.find((c) => c.includes("with_emoji"))!;
    const plainRow = calls.find((c) => c.includes("plain"))!;
    const emojiConnectionStart = visibleWidth(emojiRow.slice(0, emojiRow.indexOf("conn_1")));
    const plainConnectionStart = visibleWidth(plainRow.slice(0, plainRow.indexOf("conn_2")));
    expect(emojiConnectionStart).toBe(plainConnectionStart);
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

    await get("connections", "1");

    const url = (mockFetch.mock.calls[1] as unknown[])[0] as string;
    expect(url).toBe("http://test.local/api/v1/connections/1");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  test("fetches connection by name when the id is omitted", async () => {
    const data = { id: "conn_1", name: "Brain" };
    mockFetch.mockResolvedValueOnce(jsonResponse([data]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("connections", "Brain");

    const url = (mockFetch.mock.calls[1] as unknown[])[0] as string;
    expect(url).toBe("http://test.local/api/v1/connections/conn_1");
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

    await create("connections", '{"label":"new"}', {});

    const [url, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/connections");
    expect(opts.method).toBe("POST");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  test("posts with field flags", async () => {
    const data = { id: 2, label: "flagged" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("connections", undefined, { name: "flagged" });

    const [url, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/connections");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body as string)).toEqual({ name: "flagged", type: 20 });
  });

  test("posts connection scopes from scope flags for any provider", async () => {
    const data = { id: 2, label: "flagged" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("connections", undefined, {
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

  test("creates collection with connection name resolved to id", async () => {
    const data = { id: "col_1", displayName: "My Col", connectionId: "conn_1" };
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "conn_1", name: "Brain" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("collections", undefined, {
      "display-name": "My Col",
      "connection-id": "Brain",
    });

    const [url, opts] = mockFetch.mock.calls[1] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/collections");
    expect(JSON.parse(opts.body as string)).toMatchObject({
      displayName: "My Col",
      connectionId: "conn_1",
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

    await update("connections", "1", '{"label":"updated"}', {});

    const [url, opts] = mockFetch.mock.calls[1] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/connections/1");
    expect(opts.method).toBe("PATCH");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  test("patches with field flags", async () => {
    const data = { id: 1, label: "renamed" };
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: 1, name: "test" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await update("connections", "1", undefined, { name: "renamed", scope: "staging" });

    const [url, opts] = mockFetch.mock.calls[1] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/connections/1");
    expect(opts.method).toBe("PATCH");
    expect(JSON.parse(opts.body as string)).toEqual({ name: "renamed", scopes: ["staging"] });
  });
});

describe("del", () => {
  test("deletes and prints confirmation", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: 42, name: "test" }]));
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await del("connections", "42");

    const [url, opts] = mockFetch.mock.calls[1] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/connections/42");
    expect(opts.method).toBe("DELETE");
    expect(logSpy).toHaveBeenCalledWith("Deleted connection 42");
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
  test("prefers connection id before matching names", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { id: "same", name: "By ID" },
        { id: "conn_2", name: "same" },
      ]),
    );

    // oxlint-disable-next-line typescript/await-thenable -- bun:test .resolves returns a Promise at runtime but types lack Thenable
    await expect(resolveConnectionRef("same")).resolves.toBe("same");
  });

  test("rejects ambiguous connection names", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { id: "conn_1", name: "Brain" },
        { id: "conn_2", name: "Brain" },
      ]),
    );

    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(resolveConnectionRef("Brain")).rejects.toThrow(
      "Connection name is ambiguous; use the Connection id",
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

describe("listConnectionTypes", () => {
  test("writes connection type groups separated by blank line", () => {
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    listConnectionTypes();

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
