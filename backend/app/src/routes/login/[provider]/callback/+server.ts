import type { RequestHandler } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { decodeIdToken, type OAuth2Tokens } from "arctic";
import { SESSION_COOKIE_NAME } from "$lib/server/auth/session";
import { decodeRegistrationToken } from "$lib/server/stripe/customers";
import {
  login,
  activateUser,
  github,
  google,
  oauthProviders,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_VERIFIER_COOKIE_NAME,
  REGISTRATION_TOKEN_COOKIE_NAME,
} from "$lib/server/auth/oauth";

export const GET: RequestHandler = async ({ cookies, url, params }) => {
  if (!oauthProviders.includes(params.provider as (typeof oauthProviders)[number])) {
    throw redirect(302, "/login");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = cookies.get(OAUTH_STATE_COOKIE_NAME);
  const registrationToken = cookies.get(REGISTRATION_TOKEN_COOKIE_NAME);
  const verifier = cookies.get(OAUTH_VERIFIER_COOKIE_NAME);

  if (storedState) cookies.delete(OAUTH_STATE_COOKIE_NAME, { path: "/login" });
  if (registrationToken) cookies.delete(REGISTRATION_TOKEN_COOKIE_NAME, { path: "/login" });
  if (verifier) cookies.delete(OAUTH_VERIFIER_COOKIE_NAME, { path: "/login" });

  if (
    !code ||
    !state ||
    !storedState ||
    (!verifier && params.provider === "google") ||
    state !== storedState
  ) {
    console.warn("Invalid state or code", {
      code,
      state,
      verifier,
      storedState,
    });
    throw error(400, "Invalid request");
  }

  let tokens: OAuth2Tokens;
  try {
    tokens =
      params.provider === "github"
        ? await github.validateAuthorizationCode(code)
        : await google.validateAuthorizationCode(code, verifier!);
  } catch (e) {
    console.log("Invalid code", e);
    throw error(400, "Invalid request");
  }

  let id: string;
  let image: string;
  if (params.provider === "github") {
    const response = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokens.accessToken()}` },
    });
    const res = await response.json();
    id = res.id;
    image = `https://avatars.githubusercontent.com/u/${id}?size=100`;
  } else {
    const claims = decodeIdToken(tokens.idToken()) as { sub: string };
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.accessToken()}` },
    });
    const userInfo = await userInfoResponse.json();
    id = claims.sub;
    image = userInfo.picture;
  }

  const oauthId = `${params.provider}:${id.toString()}`;
  const result =
    (await login(oauthId)) ??
    (await activateUser(await decodeRegistrationToken(registrationToken!), oauthId));
  if (!result) throw error(400, "Invalid request");

  cookies.set(SESSION_COOKIE_NAME, `${result.token}|${image}`, {
    httpOnly: true,
    secure: true,
    path: "/",
    sameSite: "lax",
  });

  throw redirect(302, "/dashboard");
};
