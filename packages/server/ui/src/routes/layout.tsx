import { component$, Slot } from "@builder.io/qwik";
import {
  routeAction$,
  routeLoader$,
  type RequestHandler,
} from "@builder.io/qwik-city";
import Header from "~/components/ui/Header";
import type { DisplayUser } from "~/server/auth/auth";
import { getSession, SESSION_COOKIE_NAME } from "~/server/auth/auth";
import { invalidateSession, validateSessionToken } from "~/server/auth/session";

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

export const useLogout = routeAction$(
  async (_, { sharedMap, cookie, redirect }) => {
    await invalidateSession(sharedMap.get("session")?.id);
    sharedMap.delete("session");
    cookie.delete(SESSION_COOKIE_NAME);
    throw redirect(302, "/login");
  },
);

export const onRequest: RequestHandler = async ({ cookie, sharedMap }) => {
  const sessionToken = cookie.get(SESSION_COOKIE_NAME);
  if (sessionToken) {
    sharedMap.set("session", await validateSessionToken(sessionToken.value));
  }
};

export const useUser = routeLoader$((ev): DisplayUser | null => {
  return getSession(ev)?.user ?? null;
});

export default component$(() => {
  const user = useUser();
  const logout = useLogout();
  return (
    <>
      <Header user={user.value} logout={logout} />
      <Slot />
    </>
  );
});
