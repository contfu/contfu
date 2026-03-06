import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { consumerTypes } from "./generate-types";

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

beforeEach(() => {
  mockFetch.mockReset();
  process.env.CONTFU_API_KEY = "test-key";
  process.env.CONTFU_URL = "http://test.local";
  writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
  errorSpy = spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  writeSpy.mockRestore();
  errorSpy.mockRestore();
});

describe("consumerTypes", () => {
  test("fetches collections for consumer and prints map type", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { name: "posts", displayName: "Posts", schema: {} },
        { name: "authors", displayName: "Authors", schema: {} },
      ]),
    );

    await consumerTypes("7");

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe("http://test.local/api/v1/consumers/7/collections");
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const output = (writeSpy.mock.calls[0] as unknown[])[0] as string;
    expect(output).toContain("ContfuCollections");
  });
});
