import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { integrationTypes, collectionTypes } from "./generate-types";
import { getSelectedWorkspaceId } from "../http";

const mockFetch = mock<typeof fetch>();
globalThis.fetch = mockFetch as any;

void mock.module("@contfu/svc-api", () => ({
  generateApplicationIntegrationTypes: (cols: unknown[]) =>
    `export type ContfuCollections = { ${(cols as any[]).map((c) => c.name).join("; ")} };\n`,
}));

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(data: string): Response {
  return new Response(data, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function expectedApiUrl(path: string): string {
  const workspaceId = getSelectedWorkspaceId();
  return workspaceId
    ? `https://contfu.com${path}?workspace=${encodeURIComponent(workspaceId)}`
    : `https://contfu.com${path}`;
}

let writeSpy: ReturnType<typeof spyOn>;
let errorSpy: ReturnType<typeof spyOn>;
let exitSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  mockFetch.mockReset();
  process.env.CONTFU_API_KEY = "test-key";
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

describe("integrationTypes", () => {
  test("fetches collections for integration and prints map type", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "7", name: "Brain" }]));
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { name: "posts", displayName: "Posts", schema: {} },
        { name: "authors", displayName: "Authors", schema: {} },
      ]),
    );

    await integrationTypes("7");

    const url = (mockFetch.mock.calls[1] as unknown[])[0] as string;
    expect(url).toBe(expectedApiUrl("/api/v1/integrations/7/types"));
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const output = (writeSpy.mock.calls[0] as unknown[])[0] as string;
    expect(output).toContain("ContfuCollections");
  });

  test("exits when no collections connected", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "7", name: "Brain" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(integrationTypes("7")).rejects.toThrow("exit");

    expect(errorSpy).toHaveBeenCalledWith("No collections connected to this integration");
  });
});

describe("collectionTypes", () => {
  test("fetches and prints generated TypeScript returned by the API", async () => {
    const generatedTypes = "export type Pages = { id: number };\n";
    mockFetch.mockResolvedValueOnce(
      jsonResponse([{ id: "3", name: "pages", displayName: "Pages" }]),
    );
    mockFetch.mockResolvedValueOnce(textResponse(generatedTypes));

    await collectionTypes("3");

    const url = (mockFetch.mock.calls[1] as unknown[])[0] as string;
    expect(url).toBe(expectedApiUrl("/api/v1/collections/3/types"));
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy).toHaveBeenCalledWith(generatedTypes);
  });
});
