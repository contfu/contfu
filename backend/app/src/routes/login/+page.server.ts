import type { PageServerLoad, Actions } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import * as v from "valibot";
import { login } from "$lib/server/auth/local";
import { SESSION_COOKIE_NAME, guardLoggedOut } from "$lib/server/auth/session";
import { dev } from "$app/environment";

const LoginSchema = v.object({
  email: v.pipe(v.string(), v.nonEmpty("Please enter your email.")),
  password: v.pipe(v.string(), v.nonEmpty("Please enter your password.")),
});

export const load: PageServerLoad = async ({ locals, request }) => {
  guardLoggedOut(locals, request.method);
  return {};
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const formData = await request.formData();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    // Validate
    const result = v.safeParse(LoginSchema, { email, password });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.issues) {
        if (issue.path?.[0]) {
          errors[issue.path[0].key as string] = issue.message;
        }
      }
      return fail(400, { email, errors });
    }

    // Login
    const loginResult = await login(email, password);
    if (!loginResult) {
      return fail(401, { email, message: "Wrong username or password" });
    }

    // Use secure cookies in production, but allow insecure for testing over HTTP
    const isTestMode = process.env.TEST_MODE === "true";
    cookies.set(SESSION_COOKIE_NAME, loginResult.token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: !dev && !isTestMode,
    });

    throw redirect(302, "/dashboard");
  },
};
