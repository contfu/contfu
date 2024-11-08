import { component$ } from "@builder.io/qwik";

export default component$(() => {
  return (
    <header class="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div class="container mx-auto flex h-16 items-center justify-between px-4">
        <div class="flex items-center gap-2">
          <svg
            class="h-8 w-8 text-indigo-600 dark:text-indigo-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M22 2H2l10 18.5L22 2z" />
            <text
              x="12"
              y="10"
              text-anchor="middle"
              font-size="8"
              fill="currentColor"
              stroke="none"
            >
              c
            </text>
          </svg>
          <span class="text-xl font-bold text-gray-900 dark:text-white">
            Contfu
          </span>
        </div>
        <nav class="flex items-center gap-6">
          <a
            href="#features"
            class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
          >
            Features
          </a>
          <a
            href="#pricing"
            class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
          >
            Pricing
          </a>
          <a
            href="#about"
            class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
          >
            About
          </a>
          <a
            href="/login"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            Get Started
          </a>
        </nav>
      </div>
    </header>
  );
});
