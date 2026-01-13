import { component$, Slot } from "@builder.io/qwik";
import { routeAction$, routeLoader$, type RequestHandler } from "@builder.io/qwik-city";
import Header from "~/components/ui/Header";

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

export const useLogout = routeAction$(async (_, { sharedMap, cookie, redirect }) => {
  const { SESSION_COOKIE_NAME, invalidateSession } = await import("~/server/auth/session");
  await invalidateSession(sharedMap.get("session")?.id);
  sharedMap.delete("session");
  cookie.delete(SESSION_COOKIE_NAME);
  throw redirect(302, "/login");
});

export const onRequest: RequestHandler = async ({ cookie, sharedMap }) => {
  const { SESSION_COOKIE_NAME, validateSessionToken } = await import("~/server/auth/session");
  const [sessionToken, image] = cookie.get(SESSION_COOKIE_NAME)?.value.split("|") ?? [];
  if (sessionToken) {
    sharedMap.set("session", await validateSessionToken(sessionToken, image));
  }
};

export const useIsUnderConstruction = routeLoader$(async (ev) => {
  return !ev.env.get("STRIPE_TEST_KEY") && !ev.env.get("STRIPE_KEY");
});

export const useUser = routeLoader$(async (ev) => {
  const { getSession } = await import("~/server/auth/session");
  const user = getSession(ev)?.user;
  if (!user) return null;
  return {
    email: user.email,
    name: user.name,
    image: user.image ?? undefined,
  };
});

export default component$(() => {
  const user = useUser();
  const logout = useLogout();
  const isUnderConstruction = useIsUnderConstruction();
  return (
    <>
      <Header user={user.value} logout={logout} isUnderConstruction={isUnderConstruction.value} />
      <Slot />
    </>
  );
});
