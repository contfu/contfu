import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { decode } from "@toon-format/toon";

const mockFetch = mock<typeof fetch>();
globalThis.fetch = mockFetch as any;

const {
  getOrganization,
  getOrganizationUsage,
  listOrganizationMembers,
  listOrganizations,
  setOrganizationRole,
} = await import("./organizations");

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
  delete process.env.CONTFU_CLI_LINKS;
  delete process.env.NO_COLOR;
  logSpy = spyOn(console, "log").mockImplementation(() => {});
  errorSpy = spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

describe("listOrganizations", () => {
  test("prints compact agent rows by default", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        {
          id: "org_1",
          displayName: "Acme",
          name: "acme",
          role: 0,
          canManage: true,
          createdAt: "2026-01-01",
        },
      ]),
    );

    await listOrganizations("agent");

    expect(logSpy.mock.calls[0][0]).toContain("id,name,displayName,role,canManage");
    expect(logSpy.mock.calls[0][0]).not.toContain("createdAt");
  });
});

describe("getOrganization", () => {
  const organization = {
    id: "org_1",
    displayName: "Acme",
    name: "acme",
    role: 0,
    canManage: true,
    avatar: null,
    createdAt: "2026-01-01",
    updatedAt: null,
  };

  test("presents organization roles in JSON", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([organization]));

    await getOrganization("acme", "json");

    expect(JSON.parse(logSpy.mock.calls[0][0] as string)).toMatchObject({
      id: "org_1",
      role: "owner",
    });
  });

  test("uses compact agent detail output by default and expands with full", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([organization]));
    await getOrganization("acme", "agent");
    expect(decode(logSpy.mock.calls[0][0] as string)).toEqual({
      id: "org_1",
      name: "acme",
      displayName: "Acme",
      role: "owner",
      canManage: true,
    });

    logSpy.mockClear();
    mockFetch.mockResolvedValueOnce(jsonResponse([organization]));
    await getOrganization("acme", "agent", true);
    expect(decode(logSpy.mock.calls[0][0] as string)).toMatchObject({
      avatar: null,
      createdAt: "2026-01-01",
      role: "owner",
    });
  });
});

describe("getOrganizationUsage", () => {
  const organization = { id: "org_1", displayName: "Acme", name: "acme", role: 0 };
  const usage = {
    organization: { id: "org_1", displayName: "Acme", name: "acme" },
    metrics: {
      integrations: { used: 2, limit: 10 },
      collections: { used: 8, limit: null },
      flows: { used: 3, limit: 10 },
      items: { used: 120, limit: 100 },
      itemChanges: { used: 0, limit: 100 },
    },
  };

  test("resolves by name and prints every metric with deterministic bars", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse([organization]))
      .mockResolvedValueOnce(jsonResponse(usage));

    await getOrganizationUsage("acme");

    expect(logSpy.mock.calls.map((call: unknown[]) => String(call[0]))).toEqual([
      "Organization: Acme (org_1)",
      "Integrations   [####----------------] 2 / 10",
      "Collections    [--------------------] 8 / unlimited",
      "Flows          [######--------------] 3 / 10",
      "Items          [####################] 120 / 100",
      "Item changes   [--------------------] 0 / 100",
    ]);
  });

  test("reports propagated API failures", async () => {
    const exit = spyOn(process, "exit").mockImplementation((code?: number) => {
      throw new Error(`exit:${code}`);
    });
    mockFetch
      .mockResolvedValueOnce(jsonResponse([organization]))
      .mockResolvedValueOnce(jsonResponse({ message: "Quota service unavailable" }, 503));

    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(getOrganizationUsage("acme")).rejects.toThrow("exit:1");
    expect(errorSpy).toHaveBeenCalledWith("Error 503: Quota service unavailable");
    exit.mockRestore();
  });

  test("keeps JSON and agent output numeric and stable", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse([organization]))
      .mockResolvedValueOnce(jsonResponse(usage));
    await getOrganizationUsage("org_1", "json");
    expect(JSON.parse(logSpy.mock.calls[0][0] as string)).toEqual(usage);

    logSpy.mockClear();
    mockFetch
      .mockResolvedValueOnce(jsonResponse([organization]))
      .mockResolvedValueOnce(jsonResponse(usage));
    await getOrganizationUsage("org_1", "agent");
    expect(decode(logSpy.mock.calls[0][0] as string)).toEqual(usage);
  });
});

describe("listOrganizationMembers", () => {
  test("does not print service user ids", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: "org_1",
            displayName: "Acme",
            name: "acme",
            role: 0,
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            email: "owner@example.com",
            name: "Owner",
            role: 0,
          },
        ]),
      );

    await listOrganizationMembers("acme");

    const output = logSpy.mock.calls.map((call: unknown[]) => String(call[0])).join("\n");
    expect(output).toContain("Email");
    expect(output).toContain("owner@example.com");
    expect(output).not.toContain("user_");
  });
});

describe("setOrganizationRole", () => {
  test("references members by email", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: "org_1",
            displayName: "Acme",
            name: "acme",
            role: 0,
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          email: "admin+cli@example.com",
          name: "Admin",
          role: 1,
        }),
      );

    await setOrganizationRole("acme", "admin+cli@example.com", "admin");

    expect(String(mockFetch.mock.calls[1][0])).toBe(
      "https://contfu.com/api/v1/organizations/org_1/members/admin%2Bcli%40example.com",
    );
  });
});

describe("dry run", () => {
  test("setOrganizationRole resolves org but does not PATCH", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([{ id: "org_1", name: "acme", displayName: "Acme", role: 0 }]),
    );

    await setOrganizationRole("acme", "dev@example.com", "admin", { dryRun: true });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect((mockFetch.mock.calls[0] as unknown[])[1]).toMatchObject({ method: "GET" });
    expect(logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("\n")).toContain(
      "Dry run: would update organization member role",
    );
  });
});
