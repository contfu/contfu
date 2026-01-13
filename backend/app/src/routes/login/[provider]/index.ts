import type { Cookie, RequestHandler } from "@builder.io/qwik-city";
import { generateCodeVerifier, generateState } from "arctic";

export const onGet: RequestHandler = async ({ cookie, redirect, query, params }) => {
  const { github, google, oauthProviders } = await import("~/server/auth/oauth");
  const { decodeRegistrationToken, getUserByRegistrationToken } =
    await import("~/server/stripe/customers");

  if (!oauthProviders.includes(params.provider as any)) {
    throw redirect(302, "/login");
  }
  const token = query.get("token");
  if (token) {
    const registrationToken = await decodeRegistrationToken(token);

    const user = await getUserByRegistrationToken(registrationToken);

    if (!user) throw redirect(302, "/");

    await setRegistrationTokenCookie(cookie, token);
  }

  const state = await createStateCookie(cookie);
  const url =
    params.provider === "github"
      ? github.createAuthorizationURL(state, [])
      : google.createAuthorizationURL(state, await createCodeVerifierCookie(cookie), [
          "openid",
          "profile",
        ]);

  throw redirect(302, url.toString());
};

async function setRegistrationTokenCookie(cookie: Cookie, token: string) {
  const { REGISTRATION_TOKEN_COOKIE_NAME } = await import("~/server/auth/oauth");
  return setLoginCookie(cookie, REGISTRATION_TOKEN_COOKIE_NAME, token);
}

async function createCodeVerifierCookie(cookie: Cookie) {
  const { OAUTH_VERIFIER_COOKIE_NAME } = await import("~/server/auth/oauth");
  const verifier = generateCodeVerifier();
  return setLoginCookie(cookie, OAUTH_VERIFIER_COOKIE_NAME, verifier);
}

async function createStateCookie(cookie: Cookie) {
  const { OAUTH_STATE_COOKIE_NAME } = await import("~/server/auth/oauth");
  return setLoginCookie(cookie, OAUTH_STATE_COOKIE_NAME, generateState());
}

function setLoginCookie(cookie: Cookie, name: string, value: string) {
  cookie.set(name, value, {
    path: "/login",
    secure: true,
    httpOnly: true,
    maxAge: 60 * 10, // 10 minutes
    sameSite: "lax",
  });
  return value;
}
