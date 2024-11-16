import type { RequestHandler } from "@builder.io/qwik-city";
import type { OAuth2Tokens } from "arctic";
import {
  activateUser,
  github,
  login,
  OAUTH_STATE_COOKIE_NAME,
  REGISTRATION_TOKEN_COOKIE_NAME,
} from "~/server/auth/oauth";
import { SESSION_COOKIE_NAME } from "~/server/auth/session";
import { decodeRegistrationToken } from "~/server/stripe/customers";

export const onGet: RequestHandler = async (event) => {
  const { cookie, redirect, url, error } = event;

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = cookie.get(OAUTH_STATE_COOKIE_NAME)?.value;
  const registrationToken = cookie.get(REGISTRATION_TOKEN_COOKIE_NAME)?.value;
  if (storedState) cookie.delete(OAUTH_STATE_COOKIE_NAME);
  if (registrationToken) cookie.delete(REGISTRATION_TOKEN_COOKIE_NAME);

  if (!code || !state || !storedState || state !== storedState) {
    console.log("Invalid state or code", { code, state, storedState });
    throw error(400, "Invalid request");
  }

  let tokens: OAuth2Tokens;
  try {
    tokens = await github.validateAuthorizationCode(code);
  } catch (e) {
    console.log("Invalid code", e);
    throw error(400, "Invalid request");
  }

  const response = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${tokens.accessToken()}` },
  });
  const res = await response.json();
  console.log("github user", res);

  const { id } = res;

  const oauthId = `github:${id.toString()}`;
  const result =
    (await login(oauthId)) ??
    (await activateUser(
      await decodeRegistrationToken(registrationToken!),
      oauthId,
    ));
  if (!result) throw error(400, "Invalid request");

  // Set session cookie
  cookie.set(SESSION_COOKIE_NAME, result.token, {
    httpOnly: true,
    secure: true,
    path: "/",
    sameSite: "lax",
  });

  throw redirect(302, "/dashboard");
};
