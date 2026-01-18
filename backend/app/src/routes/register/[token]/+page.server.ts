import type { PageServerLoad, Actions } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import * as v from "valibot";
import { activateUser } from "$lib/server/auth/local";
import { SESSION_COOKIE_NAME, guardLoggedOut } from "$lib/server/auth/session";
import {
  decodeRegistrationToken,
  getUserByRegistrationToken,
  REGISTRATION_TOKEN_STRING_LENGTH,
} from "$lib/server/stripe/customers";

const RegisterSchema = v.object({
  password: v.pipe(v.string(), v.minLength(8, "Password must be at least 8 characters long")),
});

export const load: PageServerLoad = async ({ locals, params, request }) => {
  guardLoggedOut(locals, request.method);

  const token = await decodeRegistrationToken(params.token);
  const user = await getUserByRegistrationToken(token);

  if (!user) {
    throw redirect(302, "/");
  }

  if (params.token.length !== REGISTRATION_TOKEN_STRING_LENGTH) {
    throw redirect(302, `/register/${token.toString("base64url")}`);
  }

  return {
    userData: {
      name: user.name,
      email: user.email,
    },
  };
};

export const actions: Actions = {
  default: async ({ request, cookies, params }) => {
    const formData = await request.formData();
    const password = formData.get("password") as string;

    // Validate
    const result = v.safeParse(RegisterSchema, { password });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.issues) {
        if (issue.path?.[0]) {
          errors[issue.path[0].key as string] = issue.message;
        }
      }
      return fail(400, { errors });
    }

    // Activate user
    const token = await decodeRegistrationToken(params.token);
    const activateResult = await activateUser(token, password);
    if (!activateResult) {
      return fail(400, { message: "Failed to activate account" });
    }

    cookies.set(SESSION_COOKIE_NAME, activateResult.token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });

    throw redirect(302, "/dashboard");
  },
};
