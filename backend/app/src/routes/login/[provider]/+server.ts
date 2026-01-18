import type { RequestHandler } from "./$types";
import { redirect } from "@sveltejs/kit";
import { generateCodeVerifier, generateState } from "arctic";
import {
  github,
  google,
  oauthProviders,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_VERIFIER_COOKIE_NAME,
  REGISTRATION_TOKEN_COOKIE_NAME,
} from "$lib/server/auth/oauth";
import { decodeRegistrationToken, getUserByRegistrationToken } from "$lib/server/stripe/customers";

export const GET: RequestHandler = async ({ cookies, url, params }) => {
  if (!oauthProviders.includes(params.provider as (typeof oauthProviders)[number])) {
    throw redirect(302, "/login");
  }

  const token = url.searchParams.get("token");
  if (token) {
    const registrationToken = await decodeRegistrationToken(token);
    const user = await getUserByRegistrationToken(registrationToken);

    if (!user) throw redirect(302, "/");

    cookies.set(REGISTRATION_TOKEN_COOKIE_NAME, token, {
      path: "/login",
      secure: true,
      httpOnly: true,
      maxAge: 60 * 10,
      sameSite: "lax",
    });
  }

  const state = generateState();
  cookies.set(OAUTH_STATE_COOKIE_NAME, state, {
    path: "/login",
    secure: true,
    httpOnly: true,
    maxAge: 60 * 10,
    sameSite: "lax",
  });

  let authUrl: URL;
  if (params.provider === "github") {
    authUrl = github.createAuthorizationURL(state, []);
  } else {
    const verifier = generateCodeVerifier();
    cookies.set(OAUTH_VERIFIER_COOKIE_NAME, verifier, {
      path: "/login",
      secure: true,
      httpOnly: true,
      maxAge: 60 * 10,
      sameSite: "lax",
    });
    authUrl = google.createAuthorizationURL(state, verifier, ["openid", "profile"]);
  }

  throw redirect(302, authUrl.toString());
};
