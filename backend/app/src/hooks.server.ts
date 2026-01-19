import type { Handle } from "@sveltejs/kit";
import { SESSION_COOKIE_NAME, validateSessionToken } from "$lib/server/auth/session";

export const handle: Handle = async ({ event, resolve }) => {
  const rawCookie = event.cookies.get(SESSION_COOKIE_NAME);
  console.log("[hooks] Session cookie raw:", rawCookie?.substring(0, 20) + "...");
  const [sessionToken, image] = rawCookie?.split("|") ?? [];
  if (sessionToken) {
    console.log("[hooks] Validating session token...");
    event.locals.session = await validateSessionToken(sessionToken, image);
    console.log("[hooks] Session validated:", !!event.locals.session);
  } else {
    event.locals.session = null;
    console.log("[hooks] No session token");
  }

  const response = await resolve(event);

  // Set cache control headers for GET requests
  if (event.request.method === "GET") {
    response.headers.set("Cache-Control", "public, max-age=5, stale-while-revalidate=604800");
  }

  return response;
};
