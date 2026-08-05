import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { decode } from "@toon-format/toon";
import {
  createComponentCommand,
  inspectComponent,
  listIntegrationComponents,
  updateComponentCommand,
} from "./components";

const mockFetch = mock<typeof fetch>();
globalThis.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}

let logSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  mockFetch.mockReset();
  process.env.CONTFU_API_KEY = "test-key";
  logSpy = spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

describe("listIntegrationComponents", () => {
  test("prints compact agent rows by default", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse([{ id: "int_1", name: "CMS" }]))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: "cmp_1",
            name: "hero",
            displayName: "Hero",
            serviceRef: "hero",
            status: 0,
            propsSchema: { title: "string" },
          },
        ]),
      );

    await listIntegrationComponents("CMS", "agent");

    expect(logSpy.mock.calls[0][0]).toContain("id,name,displayName,serviceRef,status");
    expect(logSpy.mock.calls[0][0]).not.toContain("propsSchema");
  });
});

describe("inspectComponent", () => {
  const component = {
    id: "cmp_1",
    name: "hero",
    displayName: "Hero",
    serviceRef: "hero",
    status: 1,
    propsSchema: { title: "string" },
    mapping: null,
  };

  test("presents status labels in JSON", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(component));

    await inspectComponent("cmp_1", "json");

    expect(JSON.parse(logSpy.mock.calls[0][0] as string)).toMatchObject({ status: "reviewed" });
  });

  test("uses compact agent detail output by default and expands with full", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(component));
    await inspectComponent("cmp_1", "agent");
    expect(decode(logSpy.mock.calls[0][0] as string)).toEqual({
      id: "cmp_1",
      name: "hero",
      displayName: "Hero",
      serviceRef: "hero",
      status: "reviewed",
    });

    logSpy.mockClear();
    mockFetch.mockResolvedValueOnce(jsonResponse(component));
    await inspectComponent("cmp_1", "agent", true);
    expect(decode(logSpy.mock.calls[0][0] as string)).toMatchObject({
      propsSchema: { title: "string" },
      status: "reviewed",
    });
  });
});

describe("component dry run", () => {
  test("create resolves integration but does not POST", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "int_1", name: "CMS" }]));

    await createComponentCommand("CMS", {
      name: "hero",
      displayName: "Hero",
      serviceRef: "hero",
      dryRun: true,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect((mockFetch.mock.calls[0] as unknown[])[1]).toMatchObject({ method: "GET" });
    expect(logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("\n")).toContain(
      "Dry run: would create component",
    );
  });

  test("update does not PATCH", async () => {
    await updateComponentCommand("cmp_1", { displayName: "Hero", dryRun: true });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("\n")).toContain(
      "Dry run: would update component",
    );
  });
});
