import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

export default component$(() => {
  return (
    <header class="bg-white shadow-sm dark:bg-gray-800">
      <div class="container mx-auto px-4">
        <div class="flex h-16 items-center justify-between">
          <div class="flex items-center gap-2">
            <Link
              href="/"
              class="text-xl font-bold text-gray-900 dark:text-white"
            >
              Contfu
            </Link>
          </div>
          <nav class="flex items-center space-x-4">
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
          </nav>
        </div>
      </div>
    </header>
  );
});
