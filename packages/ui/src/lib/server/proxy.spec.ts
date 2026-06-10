import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

mock.restore();
process.env.CONTFU_BASIC_AUTH = "admin:secret";
const { createServerRequestHeaders, fetchFromServer, proxyToServer } = await import("./proxy");

const originalFetch = globalThis.fetch;

function makeFetchResponse() {
  return new Response("upstream", {
    status: 204,
    headers: { "x-upstream": "1" },
  });
}

describe("server proxy auth helpers", () => {
  beforeEach(() => {
    delete process.env.SERVER_URL;
  });

  afterEach(() => {
    delete process.env.SERVER_URL;
    globalThis.fetch = originalFetch;
  });

  test("strips browser authorization headers before proxying upstream", async () => {
    process.env.SERVER_URL = "http://server:3001";
    const fetchMock = mock(() => Promise.resolve(makeFetchResponse()));
    globalThis.fetch = fetchMock as typeof fetch;

    await proxyToServer(
      new Request("http://ui.local/api/items", {
        method: "POST",
        headers: {
          authorization: "Bearer browser-token",
          host: "ui.local",
          "x-trace": "1",
          "content-type": "application/json",
        },
        body: JSON.stringify({ ok: true }),
      }),
      new URL("http://ui.local/api/items?draft=true"),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://server:3001/api/items?draft=true",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
      }),
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("authorization")).toBe(
      `Basic ${Buffer.from("admin:secret").toString("base64")}`,
    );
    expect(headers.get("host")).toBeNull();
    expect(headers.get("x-trace")).toBe("1");
    expect(headers.get("content-type")).toBe("application/json");
  });

  test("replaces browser authorization headers with configured basic auth", async () => {
    process.env.SERVER_URL = "http://server:3001";
    const fetchMock = mock(() => Promise.resolve(makeFetchResponse()));
    globalThis.fetch = fetchMock as typeof fetch;

    await proxyToServer(
      new Request("http://ui.local/api/items", {
        headers: {
          authorization: "Basic browser-creds",
          host: "ui.local",
          "x-trace": "1",
        },
      }),
      new URL("http://ui.local/api/items"),
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("authorization")).toBe(
      `Basic ${Buffer.from("admin:secret").toString("base64")}`,
    );
    expect(headers.get("host")).toBeNull();
    expect(headers.get("x-trace")).toBe("1");
  });

  test("injects configured upstream basic auth for proxied requests", async () => {
    process.env.SERVER_URL = "http://server:3001";
    const fetchMock = mock(() => Promise.resolve(makeFetchResponse()));
    globalThis.fetch = fetchMock as typeof fetch;

    await proxyToServer(
      new Request("http://ui.local/api/status", {
        headers: { authorization: "Basic browser-creds" },
      }),
      new URL("http://ui.local/api/status"),
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("authorization")).toBe(
      `Basic ${Buffer.from("admin:secret").toString("base64")}`,
    );
  });

  test("adds configured upstream basic auth to shared server fetches", async () => {
    process.env.SERVER_URL = "http://server:3001";
    const fetchMock = mock(() => Promise.resolve(makeFetchResponse()));
    globalThis.fetch = fetchMock as typeof fetch;

    await fetchFromServer("/api/status", {
      headers: {
        authorization: "Basic browser-creds",
        host: "ui.local",
        accept: "application/json",
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://server:3001/api/status",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("authorization")).toBe(
      `Basic ${Buffer.from("admin:secret").toString("base64")}`,
    );
    expect(headers.get("host")).toBeNull();
    expect(headers.get("accept")).toBe("application/json");
  });

  test("replaces caller authorization headers when not explicitly stripping them", () => {
    const headers = createServerRequestHeaders({
      authorization: "Bearer browser-token",
      host: "ui.local",
      accept: "application/json",
    });

    expect(headers.get("authorization")).toBe(
      `Basic ${Buffer.from("admin:secret").toString("base64")}`,
    );
    expect(headers.get("host")).toBeNull();
    expect(headers.get("accept")).toBe("application/json");
  });

  test("uses configured basic auth when explicitly stripping caller authorization headers", () => {
    const headers = createServerRequestHeaders(
      {
        authorization: "Bearer browser-token",
        host: "ui.local",
        accept: "application/json",
      },
      { stripIncomingAuthorization: true },
    );

    expect(headers.get("authorization")).toBe(
      `Basic ${Buffer.from("admin:secret").toString("base64")}`,
    );
    expect(headers.get("host")).toBeNull();
    expect(headers.get("accept")).toBe("application/json");
  });
});
