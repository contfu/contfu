import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

export default component$(() => {
  return (
    <div class="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
      <div class="mx-auto max-w-2xl text-center">
        <img
          // eslint-disable-next-line qwik/jsx-img
          src="/logo-square.svg"
          alt="Contfu"
          height={128}
          width={128}
          loading="eager"
          class="mx-auto mb-8 h-32 w-32"
        />
        <h1 class="mb-4 text-4xl font-bold text-gray-900 dark:text-white">
          Coming Soon
        </h1>
        <p class="mb-8 text-xl text-gray-600 dark:text-gray-300">
          We're working hard to bring you something amazing. Our application is
          currently under construction.
        </p>
        <div class="text-sm text-gray-500 dark:text-gray-400">
          Thank you for your patience!
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Coming Soon",
  meta: [
    {
      name: "description",
      content:
        "Our application is currently under construction. Check back soon!",
    },
  ],
};
