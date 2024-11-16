import type { RequestHandler } from "@builder.io/qwik-city";
import { generateState } from "arctic";
import {
  github,
  OAUTH_STATE_COOKIE_NAME,
  REGISTRATION_TOKEN_COOKIE_NAME,
} from "~/server/auth/oauth";
import {
  decodeRegistrationToken,
  getUserByRegistrationToken,
} from "~/server/stripe/customers";

const providers = ["github", "google"] as const;

export const onGet: RequestHandler = async ({
  cookie,
  redirect,
  query,
  params,
}) => {
  if (!providers.includes(params.provider as any)) {
    throw redirect(302, "/login");
  }

  const sToken = query.get("token");
  if (sToken) {
    const registrationToken = await decodeRegistrationToken(sToken);

    const user = await getUserByRegistrationToken(registrationToken);

    if (!user) throw redirect(302, "/");

    cookie.set(REGISTRATION_TOKEN_COOKIE_NAME, sToken, {
      path: "/login/github",
      secure: true,
      httpOnly: true,
      maxAge: 60 * 10, // 10 minutes
      sameSite: "lax",
    });
  }

  const state = generateState();
  const url = github.createAuthorizationURL(state, []);

  cookie.set(OAUTH_STATE_COOKIE_NAME, state, {
    path: "/login/github",
    secure: true,
    httpOnly: true,
    maxAge: 60 * 10, // 10 minutes
    sameSite: "lax",
  });

  throw redirect(302, url.toString());
};
