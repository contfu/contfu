import { component$ } from "@builder.io/qwik";
import type { ActionStore } from "@builder.io/qwik-city";
import { Form, Link } from "@builder.io/qwik-city";
import type { DisplayUser } from "~/server/auth/auth";

export default component$(
  ({
    user,
    logout,
  }: {
    user: DisplayUser | null;
    logout: ActionStore<never, Record<string, unknown>, true>;
  }) => {
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
            <nav class="flex items-center space-x-4">
              {user ? (
                <div class="relative">
                  <button
                    class="flex items-center space-x-2 rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    onClick$={() => {
                      const menu = document.getElementById("userMenu");
                      menu?.classList.toggle("hidden");
                    }}
                  >
                    <div class="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400">
                      {user.name[0].toUpperCase()}
                    </div>
                  </button>
                  <div
                    id="userMenu"
                    class="absolute right-0 mt-2 hidden w-48 bg-white py-2 shadow-lg dark:bg-gray-800"
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
