import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const originalFetch = globalThis.fetch;
process.env.CONTFU_BASIC_AUTH = "admin:secret";
const { handle } = await import("./hooks.server");

function makeResolve(status = 200, body = "resolved") {
  return mock(() => new Response(body, { status }));
}

function makeEvent(pathname: string, requestInit: RequestInit = {}) {
  const request = new Request(`http://localhost${pathname}`, requestInit);
  const resolve = makeResolve();

  return {
    event: {
      url: new URL(request.url),
      request,
    },
    resolve,
  };
}

function makeBasicAuthHeader(value: string) {
  return `Basic ${Buffer.from(value).toString("base64")}`;
}

describe("ui hooks basic auth", () => {
  beforeEach(() => {
    delete process.env.SERVER_URL;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("proxied", { status: 202 })),
    ) as typeof fetch;
  });

  afterEach(() => {
    delete process.env.SERVER_URL;
    globalThis.fetch = originalFetch;
  });

  test("leaves requests with valid basic auth unchanged", async () => {
    const { event, resolve } = makeEvent("/dashboard", {
      headers: { authorization: makeBasicAuthHeader("admin:secret") },
    });

    const response = await handle({ event: event as never, resolve: resolve as never });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("resolved");
    expect(resolve).toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("rejects browser requests without credentials when ui basic auth is configured", async () => {
    const { event, resolve } = makeEvent("/dashboard");

    const response = await handle({ event: event as never, resolve: resolve as never });

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe('Basic realm="Contfu"');
    expect(resolve).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("allows browser requests with valid credentials", async () => {
    const { event, resolve } = makeEvent("/dashboard", {
      headers: { authorization: makeBasicAuthHeader("admin:secret") },
    });

    const response = await handle({ event: event as never, resolve: resolve as never });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("resolved");
    expect(resolve).toHaveBeenCalled();
  });

  test("skips ui basic auth for sveltekit app assets", async () => {
    const { event, resolve } = makeEvent("/_app/immutable/app.js");

    const response = await handle({ event: event as never, resolve: resolve as never });

    expect(response.status).toBe(200);
    expect(resolve).toHaveBeenCalled();
  });

  test("applies ui basic auth before proxying api requests", async () => {
    const { event, resolve } = makeEvent("/api/status");

    const response = await handle({ event: event as never, resolve: resolve as never });

    expect(response.status).toBe(401);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });

  test("proxies api requests after successful ui basic auth", async () => {
    process.env.SERVER_URL = "http://server:3001";
    const { event, resolve } = makeEvent("/api/status", {
      headers: { authorization: makeBasicAuthHeader("admin:secret") },
    });

    const response = await handle({ event: event as never, resolve: resolve as never });

    expect(response.status).toBe(202);
    expect(await response.text()).toBe("proxied");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://server:3001/api/status",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    const init = (globalThis.fetch as ReturnType<typeof mock>).mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("authorization")).toBe(makeBasicAuthHeader("admin:secret"));
    expect(resolve).not.toHaveBeenCalled();
  });
});
