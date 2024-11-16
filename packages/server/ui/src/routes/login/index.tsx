import { component$, useTask$ } from "@builder.io/qwik";
import type { RequestHandler } from "@builder.io/qwik-city";
import { routeLoader$, useNavigate } from "@builder.io/qwik-city";
import { isBrowser } from "@builder.io/qwik/build";
import type { InitialValues } from "@modular-forms/qwik";
import {
  formAction$,
  FormError,
  useForm,
  valiForm$,
} from "@modular-forms/qwik";
import * as v from "valibot";
import type { DisplayUser } from "~/server/auth/session";

export const onRequest: RequestHandler = async (event) => {
  const { guardLoggedOut } = await import("~/server/auth/session");
  guardLoggedOut(event);
};

const LoginSchema = v.object({
  email: v.pipe(v.string(), v.nonEmpty("Please enter your email.")),
  password: v.pipe(v.string(), v.nonEmpty("Please enter your password.")),
});

type LoginForm = v.InferInput<typeof LoginSchema>;

export const useFormLoader = routeLoader$<InitialValues<LoginForm>>(() => ({
  email: "",
  password: "",
}));

export const useFormAction = formAction$<LoginForm, DisplayUser>(
  async (values, { cookie }) => {
    if (isBrowser) return;
    const { login } = await import("~/server/auth/local");
    const { SESSION_COOKIE_NAME } = await import("~/server/auth/session");
    const minDuration = new Promise((resolve) => setTimeout(resolve, 200));
    const result = await login(values.email, values.password);
    if (!result) {
      await minDuration;
      throw new FormError<LoginForm>("Wrong username or password");
    }

    cookie.set(SESSION_COOKIE_NAME, result.token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });

    return {
      status: "success",
      data: result.user,
    };
  },
  valiForm$(LoginSchema),
);

export default component$(() => {
  const nav = useNavigate();
  const [loginForm, { Form, Field }] = useForm<LoginForm, DisplayUser>({
    loader: useFormLoader(),
    action: useFormAction(),
    validate: valiForm$(LoginSchema),
  });

  useTask$(({ track }) => {
    track(() => loginForm.response.status);
    if (isBrowser && loginForm.response.status === "success") {
      nav("/dashboard");
    }
  });

  return (
    <div class="min-h-screen bg-gray-50 py-12 dark:bg-gray-900">
      <div class="container mx-auto px-4">
        <div class="mx-auto max-w-md">
          <div class="rounded-lg bg-white p-8 shadow-md dark:bg-gray-800">
            <h2 class="mb-6 text-center text-3xl font-bold text-gray-900 dark:text-white">
              Login to your account
            </h2>

            <Form class="space-y-6">
              <Field name="email">
                {(field, props) => (
                  <div>
                    <label
                      for={props.name}
                      class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Email address
                    </label>
                    <input
                      {...props}
                      type="email"
                      class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                    {field.error && (
                      <div class="mt-1 text-sm text-red-600 dark:text-red-400">
                        {field.error}
                      </div>
                    )}
                  </div>
                )}
              </Field>

              <Field name="password">
                {(field, props) => (
                  <div>
                    <label
                      for={props.name}
                      class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Password
                    </label>
                    <input
                      {...props}
                      type="password"
                      class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                    {field.error && (
                      <div class="mt-1 text-sm text-red-600 dark:text-red-400">
                        {field.error}
                      </div>
                    )}
                  </div>
                )}
              </Field>

              <div>
                <button
                  type="submit"
                  disabled={loginForm.submitting}
                  class={`w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:bg-indigo-500 dark:hover:bg-indigo-600 ${
                    loginForm.submitting ? "cursor-not-allowed opacity-75" : ""
                  }`}
                >
                  {loginForm.submitting ? "Signing in..." : "Sign in"}
                </button>
              </div>

              {loginForm.response.status === "error" &&
                loginForm.response.message && (
                  <div class="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/50 dark:text-red-400">
                    {loginForm.response.message}
                  </div>
                )}
            </Form>

            <div class="mt-6">
              <div class="relative">
                <div class="absolute inset-0 flex items-center">
                  <div class="w-full border-t border-gray-300 dark:border-gray-600"></div>
                </div>
                <div class="relative flex justify-center text-sm">
                  <span class="bg-white px-2 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    Or continue with
                  </span>
                </div>
              </div>

              <div class="mt-6 grid grid-cols-2 gap-3">
                <form action={`/login/github`} method="get">
                  <button
                    type="submit"
                    class="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  >
                    <svg class="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                      />
                    </svg>
                    GitHub
                  </button>
                </form>
                <form action="/login/google" method="get">
                  <button
                    type="submit"
                    class="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  >
                    <svg class="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
                      />
                    </svg>
                    Google
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
