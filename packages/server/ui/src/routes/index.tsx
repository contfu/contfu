import { component$, useSignal } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";

const features = [
  {
    icon: (
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    ),
    title: "Universal Integration",
    description:
      "Connect with any CMS platform through our standardized API interface.",
  },
  {
    icon: (
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    ),
    title: "Real-time Sync",
    description:
      "Keep your content in sync across all platforms automatically.",
  },
  {
    icon: (
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    ),
    title: "Normalized Data",
    description:
      "Work with a consistent data format regardless of the source CMS.",
  },
];

export const useProducts = routeLoader$(async () => {
  const { getStripeProducts } = await import("~/server/stripe/products");
  return (await getStripeProducts()).filter((p) => !p.hidden);
});

export default component$(() => {
  const isYearly = useSignal(true);
  const products = useProducts();

  return (
    <main class="dark:bg-gray-900">
      {/* Hero Section */}
      <section class="bg-gradient-to-b from-white to-gray-50 py-40 dark:from-gray-900 dark:to-gray-800">
        <div class="container mx-auto px-4">
          <div class="mx-auto max-w-4xl text-center">
            <h1 class="mb-6 text-5xl font-bold tracking-tight text-gray-900 dark:text-white">
              Power-up your favourite CMS
            </h1>
            <p class="mb-10 text-xl text-gray-600 dark:text-gray-300">
              Seamlessly synchronize and normalize data across multiple CMS
              platforms. One API to rule them all.
            </p>
            <div class="flex justify-center gap-4">
              <a
                href="#pricing"
                class="bg-primary-400 hover:bg-primary-500 dark:bg-primary-500 dark:hover:bg-primary-400 rounded-lg px-6 py-3 text-lg font-semibold text-white"
              >
                Boost your CMS
              </a>
              <a
                href="#features"
                class="rounded-lg border border-gray-300 bg-white px-6 py-3 text-lg font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Learn more
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" class="py-20">
        <div class="container mx-auto px-4">
          <h2 class="mb-12 text-center text-3xl font-bold text-gray-900 dark:text-white">
            Why choose Contfu?
          </h2>
          <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                class="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800"
              >
                <div class="bg-primary-100 dark:bg-primary-900 mb-4 flex h-12 w-12 items-center justify-center rounded-full p-3">
                  <svg
                    class="text-primary-600 dark:text-primary-400 h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {feature.icon}
                  </svg>
                </div>
                <h3 class="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                  {feature.title}
                </h3>
                <p class="text-gray-600 dark:text-gray-300">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" class="bg-gray-50 py-20 dark:bg-gray-800">
        <div class="container mx-auto px-4">
          <h2 class="mb-12 text-center text-3xl font-bold text-gray-900 dark:text-white">
            Simple, transparent pricing
          </h2>
          <p class="mb-8 text-center text-gray-600 dark:text-gray-300">
            All plans come with a 7-day free trial.
          </p>
          <div class="mb-8 flex justify-center">
            <div class="flex items-center gap-3">
              <span
                class={`text-sm ${!isYearly.value ? "text-primary-600 dark:text-primary-400 font-bold" : "text-gray-600 dark:text-gray-400"}`}
              >
                Monthly
              </span>
              <button
                onClick$={() => (isYearly.value = !isYearly.value)}
                class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isYearly.value
                    ? "bg-primary-600 dark:bg-primary-500"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isYearly.value ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span
                class={`text-sm ${isYearly.value ? "text-primary-600 dark:text-primary-400 font-bold" : "text-gray-600 dark:text-gray-400"}`}
              >
                Yearly <span class="text-xs text-green-500">(Save 20%)</span>
              </span>
            </div>
          </div>
          <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
            {products.value.map((product) => {
              const price =
                product.prices[isYearly.value ? "yearly" : "monthly"];
              return (
                price && (
                  <div
                    key={product.name}
                    class={`relative rounded-lg bg-white p-8 ${product.recommended ? "shadow-lg" : "shadow-sm"} dark:bg-gray-900`}
                  >
                    {product.recommended && (
                      <div class="bg-primary-600 dark:bg-primary-500 absolute -top-4 left-0 right-0 mx-auto w-32 rounded-full py-1 text-center text-sm font-semibold text-white">
                        Recommended
                      </div>
                    )}
                    <h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">
                      {product.name}
                    </h3>
                    <div class="mb-4">
                      <span class="text-4xl font-bold text-gray-900 dark:text-white">
                        €
                        {isYearly.value
                          ? Math.round(price.amount / 12)
                          : price.amount}
                      </span>
                      <span class="text-gray-600 dark:text-gray-400">
                        /month
                      </span>
                      {isYearly.value && (
                        <div class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Billed €{price.amount}/year
                        </div>
                      )}
                    </div>
                    {product.description && (
                      <div class="text-sm text-gray-500 dark:text-gray-400">
                        {product.description}
                      </div>
                    )}
                    <ul class="my-2 mb-8 space-y-3 text-gray-600 dark:text-gray-300">
                      {product.features.map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                    <a
                      href={price.url}
                      class={`block w-full rounded-lg px-4 py-2 text-center font-semibold ${
                        product.recommended
                          ? "bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white"
                          : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      }`}
                    >
                      Get Started
                    </a>
                  </div>
                )
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section class="bg-primary-400 dark:bg-primary-600 py-20">
        <div class="container mx-auto px-4 text-center">
          <h2 class="mb-6 text-3xl font-bold text-white">
            Ready to streamline your content management?
          </h2>
          <a
            href="#pricing"
            class="text-primary-600 dark:text-primary-400 inline-block rounded-lg bg-white px-6 py-3 text-lg font-semibold hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            Get started today
          </a>
        </div>
      </section>
    </main>
  );
});
