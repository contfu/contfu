import type { Cookie, RequestHandler } from "@builder.io/qwik-city";
import { generateCodeVerifier, generateState } from "arctic";
import {
  github,
  google,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_VERIFIER_COOKIE_NAME,
  oauthProviders,
  REGISTRATION_TOKEN_COOKIE_NAME,
} from "~/server/auth/oauth";
import {
  decodeRegistrationToken,
  getUserByRegistrationToken,
} from "~/server/stripe/customers";

export const onGet: RequestHandler = async ({
  cookie,
  redirect,
  query,
  params,
}) => {
  if (!oauthProviders.includes(params.provider as any)) {
    throw redirect(302, "/login");
  }
  const token = query.get("token");
  if (token) {
    const registrationToken = await decodeRegistrationToken(token);

    const user = await getUserByRegistrationToken(registrationToken);

    if (!user) throw redirect(302, "/");

    setRegistrationTokenCookie(cookie, token);
  }

  const state = createStateCookie(cookie);
  const url =
    params.provider === "github"
      ? github.createAuthorizationURL(state, [])
      : google.createAuthorizationURL(state, createCodeVerifierCookie(cookie), [
          "openid",
          "profile",
        ]);

  throw redirect(302, url.toString());
};

function setRegistrationTokenCookie(cookie: Cookie, token: string) {
  return setLoginCookie(cookie, REGISTRATION_TOKEN_COOKIE_NAME, token);
}

function createCodeVerifierCookie(cookie: Cookie) {
  const verifier = generateCodeVerifier();
  return setLoginCookie(cookie, OAUTH_VERIFIER_COOKIE_NAME, verifier);
}

function createStateCookie(cookie: Cookie) {
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
