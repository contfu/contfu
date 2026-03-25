import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { connectionTypes, collectionTypes } from "./generate-types";

const mockFetch = mock<typeof fetch>();
globalThis.fetch = mockFetch as any;

void mock.module("@contfu/core", () => ({
  generateConsumerTypes: (cols: unknown[]) =>
    `export type ContfuCollections = { ${(cols as any[]).map((c) => c.name).join("; ")} };\n`,
}));

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

let writeSpy: ReturnType<typeof spyOn>;
let errorSpy: ReturnType<typeof spyOn>;
let exitSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  mockFetch.mockReset();
  process.env.CONTFU_API_KEY = "test-key";
  process.env.CONTFU_URL = "http://test.local";
  writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
  errorSpy = spyOn(console, "error").mockImplementation(() => {});
  exitSpy = spyOn(process, "exit").mockImplementation(() => {
    throw new Error("exit");
  });
});

afterEach(() => {
  writeSpy.mockRestore();
  errorSpy.mockRestore();
  exitSpy.mockRestore();
});

describe("connectionTypes", () => {
  test("fetches collections for connection and prints map type", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { name: "posts", displayName: "Posts", schema: {} },
        { name: "authors", displayName: "Authors", schema: {} },
      ]),
    );

    await connectionTypes("7");

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe("http://test.local/api/v1/connections/7/types");
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const output = (writeSpy.mock.calls[0] as unknown[])[0] as string;
    expect(output).toContain("ContfuCollections");
  });

  test("exits when no collections connected", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(connectionTypes("7")).rejects.toThrow("exit");

    expect(errorSpy).toHaveBeenCalledWith("No collections connected to this connection");
  });
});

describe("collectionTypes", () => {
  test("fetches types for collection and prints map type", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([{ name: "pages", displayName: "Pages", schema: {} }]),
    );

    await collectionTypes("3");

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe("http://test.local/api/v1/collections/3/types");
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const output = (writeSpy.mock.calls[0] as unknown[])[0] as string;
    expect(output).toContain("ContfuCollections");
  });

  test("exits when no types found for collection", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(collectionTypes("3")).rejects.toThrow("exit");

    expect(errorSpy).toHaveBeenCalledWith("No types found for this collection");
  });
});
