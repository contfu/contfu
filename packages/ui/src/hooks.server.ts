import type { Handle } from "@sveltejs/kit";

const defaultServerUrl = "http://localhost:3001";

function resolveServerUrl(): string {
  return (process.env.SERVER_URL ?? defaultServerUrl).replace(/\/$/, "");
}

export const handle: Handle = async ({ event, resolve }) => {
  if (!event.url.pathname.startsWith("/api/")) {
    return resolve(event);
  }

  const upstreamUrl = `${resolveServerUrl()}${event.url.pathname}${event.url.search}`;
  const headers = new Headers(event.request.headers);
  headers.delete("host");

  const body =
    event.request.method === "GET" || event.request.method === "HEAD"
      ? undefined
      : await event.request.arrayBuffer();

  const upstream = await fetch(upstreamUrl, {
    method: event.request.method,
    headers,
    body,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
};
