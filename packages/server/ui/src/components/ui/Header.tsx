import { component$, useSignal } from "@builder.io/qwik";
import type { ActionStore } from "@builder.io/qwik-city";
import { Form, Link } from "@builder.io/qwik-city";
import type { DisplayUser } from "~/server/auth/session";
import Avatar from "./Avatar";

export default component$(
  ({
    user,
    logout,
  }: {
    user: DisplayUser | null;
    logout: ActionStore<never, Record<string, unknown>, true>;
  }) => {
    const isOpen = useSignal(false);
    return (
      <header class="bg-white shadow-sm dark:bg-gray-800">
        <div class="container mx-auto px-4">
          <div class="flex h-16 items-center justify-between">
            <div class="flex items-center gap-2">
              <Link
                href={user ? "/dashboard" : "/"}
                class="text-xl font-bold text-gray-900 dark:text-white"
              >
                Contfu
              </Link>
            </div>
            <nav class="flex h-full items-center space-x-4">
              {user ? (
                <div class="relative flex h-full items-center">
                  <button
                    class="peer flex h-14 items-center space-x-2 rounded-lg px-4 py-0 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    onClick$={(_, b) => {
                      if (isOpen.value) b.blur();
                      else isOpen.value = true;
                    }}
                    onBlur$={() => {
                      isOpen.value = false;
                    }}
                  >
                    <Avatar user={user} />
                  </button>
                  <div
                    class="absolute right-0 top-14 mt-2 hidden w-48 bg-white py-2 shadow-lg peer-focus:block dark:bg-gray-800"
                    preventdefault:mousedown
                  >
                    <span class="block w-full px-4 py-2 text-gray-400 dark:text-gray-500">
                      {user.name}
                    </span>
                    <Form action={logout}>
                      <button
                        type="submit"
                        class="block w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        Logout
                      </button>
                    </Form>
                  </div>
                </div>
              ) : (
                <>
                  <Link
                    href="#features"
                    class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                  >
                    Features
                  </Link>
                  <Link
                    href="#pricing"
                    class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                  >
                    Pricing
                  </Link>
                  <Link
                    href="/login"
                    class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                  >
                    Login
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>
    );
  },
);
