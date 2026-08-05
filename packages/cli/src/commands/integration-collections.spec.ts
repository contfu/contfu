import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import {
  addIntegrationCollections,
  parseAddRefs,
  printAddSummary,
  scanIntegrationCollections,
} from "./integration-collections";

const mockFetch = mock<typeof fetch>();
globalThis.fetch = mockFetch as unknown as typeof fetch;

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
  logSpy = spyOn(console, "log").mockImplementation(() => {});
  errorSpy = spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

describe("parseAddRefs", () => {
  test("parses comma-separated refs", () => {
    expect(parseAddRefs("articles, authors ,,tags")).toEqual(["articles", "authors", "tags"]);
  });
});

describe("scanIntegrationCollections", () => {
  test("prints scanned collections as JSON", async () => {
    const collections = [{ ref: "db-1", displayName: "Blog Posts", alreadyAdded: false }];
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "42", name: "Brain" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse(collections));

    await scanIntegrationCollections("42", { format: "json" });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const url = mockFetch.mock.calls[1][0] as string;
    expect(url).toContain("/api/v1/integrations/42/scan");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(collections, null, 2));
  });

  test("prints scanned collections as agent output", async () => {
    const collections = [{ ref: "db-1", displayName: "Blog Posts", alreadyAdded: false }];
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "42", name: "Brain" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse(collections));

    await scanIntegrationCollections("42", { format: "agent" });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("[1]{ref,displayName,alreadyAdded}:"),
    );
  });

  test("includes service metadata only in full agent output", async () => {
    const collections = [
      {
        ref: "db-1",
        displayName: "Blog Posts",
        alreadyAdded: false,
        locales: ["en", "de"],
      },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "42", name: "Brain" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse(collections));
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "42", name: "Brain" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse(collections));

    await scanIntegrationCollections("42", { format: "agent" });
    await scanIntegrationCollections("42", { format: "agent", full: true });

    expect(logSpy.mock.calls[0][0]).not.toContain("locales");
    expect(logSpy.mock.calls[1][0]).toContain("locales");
  });

  test("prints scanned collections in table format", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "42", name: "Brain" }]));
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { ref: "db-1", displayName: "Blog Posts", alreadyAdded: false },
        { ref: "db-2", displayName: "Authors", alreadyAdded: true },
      ]),
    );

    await scanIntegrationCollections("42", { format: "default" });

    const calls: unknown[] = logSpy.mock.calls.map((call: unknown[]) => call[0]);
    expect(calls.some((call) => String(call).includes("Display Name"))).toBe(true);
    expect(calls.some((call) => String(call).includes("already added"))).toBe(true);
  });
});

describe("addIntegrationCollections", () => {
  test("posts refs to the add endpoint", async () => {
    const summary = {
      added: [{ ref: "db-1", id: "5", displayName: "Blog Posts" }],
      alreadyAdded: [],
      scanned: 2,
    };
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "42", name: "Brain" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse(summary, 201));

    await addIntegrationCollections("Brain", { format: "json", refs: ["db-1"] });

    const [url, options] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(url).toContain("/api/v1/integrations/42/add");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body as string)).toEqual({ refs: ["db-1"] });
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(summary, null, 2));
  });

  test("posts all=true when requested", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "42", name: "Brain" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse({ added: [], alreadyAdded: [], scanned: 0 }, 201));

    await addIntegrationCollections("42", { format: "json", all: true });

    const [, options] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(options.body as string)).toEqual({ all: true });
  });

  test("requires one add selection mode", async () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });

    // oxlint-disable-next-line typescript-eslint/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(addIntegrationCollections("42", { format: "default" })).rejects.toThrow("exit");
    expect(errorSpy).toHaveBeenCalledWith(
      "Usage: contfu integrations add <integration-id-or-name> (--refs <comma-separated> | --all | --select)",
    );

    exitSpy.mockRestore();
  });

  test("requires an interactive TTY for --select", async () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "42", name: "Brain" }]));
    mockFetch.mockResolvedValueOnce(
      jsonResponse([{ ref: "db-1", displayName: "Blog Posts", alreadyAdded: false }]),
    );

    // oxlint-disable-next-line typescript-eslint/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(
      addIntegrationCollections("42", { format: "default", select: true }),
    ).rejects.toThrow("exit");
    expect(errorSpy).toHaveBeenCalledWith("--select requires an interactive TTY");

    exitSpy.mockRestore();
  });

  test("rejects ambiguous add selection modes", async () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });

    // oxlint-disable-next-line typescript-eslint/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(
      addIntegrationCollections("42", { format: "default", refs: ["db-1"], select: true }),
    ).rejects.toThrow("exit");
    expect(errorSpy).toHaveBeenCalledWith(
      "Usage: contfu integrations add <integration-id-or-name> (--refs <comma-separated> | --all | --select)",
    );

    exitSpy.mockRestore();
  });
});

describe("printAddSummary", () => {
  test("prints a human-readable summary", () => {
    printAddSummary({
      scanned: 3,
      added: [{ ref: "articles", id: "1", displayName: "Articles" }],
      alreadyAdded: [{ ref: "authors", displayName: "Authors", alreadyAdded: true }],
    });

    const calls: string[] = logSpy.mock.calls.map((call: unknown[]) => String(call[0]));
    expect(calls.some((call) => call.includes("Scanned 3 collections."))).toBe(true);
    expect(calls.some((call) => call.includes("Added 1 collection."))).toBe(true);
    expect(calls.some((call) => call.includes("Already added:"))).toBe(true);
  });
});

describe("dry run", () => {
  test("add resolves integration but does not POST", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "42", name: "Brain" }]));

    await addIntegrationCollections("Brain", { format: "default", refs: ["db-1"], dryRun: true });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect((mockFetch.mock.calls[0] as unknown[])[1]).toMatchObject({ method: "GET" });
    expect(logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("\n")).toContain(
      "Dry run: would add scanned collections",
    );
  });
});
