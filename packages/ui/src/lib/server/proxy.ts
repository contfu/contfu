import { basicAuth, buildBasicAuthHeader } from "./basic-auth";

const defaultServerUrl = "http://localhost:3001";

export function resolveServerUrl(): string {
  return (process.env.SERVER_URL ?? defaultServerUrl).replace(/\/$/, "");
}

export function createServerRequestHeaders(
  headersInit?: HeadersInit,
  opts: { stripIncomingAuthorization?: boolean } = {},
): Headers {
  const headers = new Headers(headersInit);

  if (opts.stripIncomingAuthorization || basicAuth) {
    headers.delete("authorization");
  }

  headers.delete("host");

  if (basicAuth) {
    headers.set("authorization", buildBasicAuthHeader(basicAuth));
  }

  return headers;
}

export function createServerRequestInit(
  init: RequestInit = {},
  opts: { stripIncomingAuthorization?: boolean } = {},
): RequestInit {
  return {
    ...init,
    headers: createServerRequestHeaders(init.headers, opts),
  };
}

export function fetchFromServer(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${resolveServerUrl()}${path}`, createServerRequestInit(init));
}

export async function proxyToServer(request: Request, url: URL): Promise<Response> {
  const body =
    request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();

  const upstream = await fetch(`${resolveServerUrl()}${url.pathname}${url.search}`, {
    method: request.method,
    headers: createServerRequestHeaders(request.headers, { stripIncomingAuthorization: true }),
    body,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
}
