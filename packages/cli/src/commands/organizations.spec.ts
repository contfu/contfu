import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

const mockFetch = mock<typeof fetch>();
globalThis.fetch = mockFetch as any;

const { listOrganizationMembers, setOrganizationRole } = await import("./organizations");

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
      "http://test.local/api/v1/organizations/org_1/members/admin%2Bcli%40example.com",
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
