import type { RequestHandler } from "@builder.io/qwik-city";
import { decodeIdToken, type OAuth2Tokens } from "arctic";

export const onGet: RequestHandler = async ({
  cookie,
  redirect,
  url,
  error,
  params,
}) => {
  const { SESSION_COOKIE_NAME } = await import("~/server/auth/session");
  const { decodeRegistrationToken } = await import("~/server/stripe/customers");
  const {
    login,
    activateUser,
    github,
    google,
    oauthProviders,
    OAUTH_STATE_COOKIE_NAME,
    OAUTH_VERIFIER_COOKIE_NAME,
    REGISTRATION_TOKEN_COOKIE_NAME,
  } = await import("~/server/auth/oauth");
  if (!oauthProviders.includes(params.provider as any)) {
    throw redirect(302, "/login");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = cookie.get(OAUTH_STATE_COOKIE_NAME)?.value;
  const registrationToken = cookie.get(REGISTRATION_TOKEN_COOKIE_NAME)?.value;
  const verifier = cookie.get(OAUTH_VERIFIER_COOKIE_NAME)?.value;
  if (storedState) cookie.delete(OAUTH_STATE_COOKIE_NAME);
  if (registrationToken) cookie.delete(REGISTRATION_TOKEN_COOKIE_NAME);
  if (verifier) cookie.delete(OAUTH_VERIFIER_COOKIE_NAME);

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
    const claims = decodeIdToken(tokens.idToken()) as any;
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokens.accessToken()}` } },
    );
    const userInfo = await userInfoResponse.json();
    id = claims.sub;
    image = userInfo.picture;
  }

  const oauthId = `${params.provider}:${id.toString()}`;
  const result =
    (await login(oauthId)) ??
    (await activateUser(
      await decodeRegistrationToken(registrationToken!),
      oauthId,
    ));
  if (!result) throw error(400, "Invalid request");

  cookie.set(SESSION_COOKIE_NAME, `${result.token}|${image}`, {
    httpOnly: true,
    secure: true,
    path: "/",
    sameSite: "lax",
  });

  throw redirect(302, "/dashboard");
};
