import type { Handle } from "@sveltejs/kit/hooks";
import { basicAuth, checkBasicAuth } from "./lib/server/basic-auth";
import { proxyToServer } from "./lib/server/proxy";

function shouldSkipBrowserBasicAuth(pathname: string) {
  return pathname.startsWith("/_app/") || pathname === "/favicon.ico";
}

export const handle: Handle = async ({ event, resolve }) => {
  if (!shouldSkipBrowserBasicAuth(event.url.pathname)) {
    const authError = checkBasicAuth(event.request, basicAuth);
    if (authError) {
      return authError;
    }
  }

  if (event.url.pathname.startsWith("/api/") || event.url.pathname.startsWith("/files/")) {
    return proxyToServer(event.request, event.url);
  }

  return resolve(event);
};
