import { component$, Slot } from "@builder.io/qwik";
import { routeLoader$, type RequestHandler } from "@builder.io/qwik-city";
import Header from "~/components/ui/Header";
import type { DisplayUser } from "~/server/auth/auth";
import { getUser, SESSION_COOKIE_NAME } from "~/server/auth/auth";
import { validateSessionToken } from "~/server/auth/session";

export const onGet: RequestHandler = async ({ cacheControl }) => {
  // Control caching for this request for best performance and to reduce hosting costs:
  // https://qwik.dev/docs/caching/
  cacheControl({
    // Always serve a cached response by default, up to a week stale
    staleWhileRevalidate: 60 * 60 * 24 * 7,
    // Max once every 5 seconds, revalidate on the server to get a fresh version of this page
    maxAge: 5,
  });
};

export const onRequest: RequestHandler = async ({
  headers,
  cookie,
  error,
  sharedMap,
}) => {
  const origin = process.env.ORIGIN ?? null;
  if (headers.get("origin") !== origin) throw error(403, "Origin not allowed");
  const sessionToken = cookie.get(SESSION_COOKIE_NAME);
  if (sessionToken) {
    const session = await validateSessionToken(sessionToken.value);
    if (session) {
      sharedMap.set("user", session.user);
    }
  }
};

export const useUser = routeLoader$((ev): DisplayUser | null => {
  return getUser(ev);
});

export default component$(() => {
  const user = useUser();
  return (
    <>
      <Header user={user.value} />
      <Slot />
    </>
  );
});
