import type { Handle } from "@sveltejs/kit";
import { proxyToServer } from "$lib/server/proxy";

export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith("/api/") || event.url.pathname.startsWith("/files/")) {
    return proxyToServer(event.request, event.url);
  }

  return resolve(event);
};
