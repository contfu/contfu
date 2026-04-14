const defaultServerUrl = "http://localhost:3001";

function resolveServerUrl(): string {
  return (process.env.SERVER_URL ?? defaultServerUrl).replace(/\/$/, "");
}

export async function proxyToServer(request: Request, url: URL): Promise<Response> {
  const upstreamUrl = `${resolveServerUrl()}${url.pathname}${url.search}`;
  const headers = new Headers(request.headers);
  headers.delete("host");

  const body =
    request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
}
