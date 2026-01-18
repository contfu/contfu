import type { Handle } from "@sveltejs/kit";
import { SESSION_COOKIE_NAME, validateSessionToken } from "$lib/server/auth/session";

export const handle: Handle = async ({ event, resolve }) => {
  const [sessionToken, image] = event.cookies.get(SESSION_COOKIE_NAME)?.split("|") ?? [];
  if (sessionToken) {
    event.locals.session = await validateSessionToken(sessionToken, image);
  } else {
    event.locals.session = null;
  }

  const response = await resolve(event);

  // Set cache control headers for GET requests
  if (event.request.method === "GET") {
    response.headers.set("Cache-Control", "public, max-age=5, stale-while-revalidate=604800");
  }

  return response;
};
