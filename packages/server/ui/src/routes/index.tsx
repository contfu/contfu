import { component$ } from "@builder.io/qwik";

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

const plans = [
  {
    name: "Starter",
    price: 5,
    features: ["1 source", "10 collections", "1,000 items"],
    recommended: false,
  },
  {
    name: "Scaler",
    price: 20,
    features: ["3 sources", "30 collections", "50,000 items"],
    recommended: true,
  },
  {
    name: "Business",
    price: 60,
    features: ["10 sources", "100 collections", "300,000 items"],
    recommended: false,
  },
  {
    name: "Enterprise",
    price: 200,
    features: ["50 sources", "1,000 collections", "1,000,000 items"],
    recommended: false,
  },
];

export default component$(() => {
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
                class="rounded-lg bg-indigo-600 px-6 py-3 text-lg font-semibold text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
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
                <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 p-3 dark:bg-indigo-900">
                  <svg
                    class="h-6 w-6 text-indigo-600 dark:text-indigo-400"
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
          <div class="grid grid-cols-1 gap-8 md:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                class={`relative rounded-lg bg-white p-8 ${plan.recommended ? "shadow-lg" : "shadow-sm"} dark:bg-gray-900`}
              >
                {plan.recommended && (
                  <div class="absolute -top-4 left-0 right-0 mx-auto w-32 rounded-full bg-indigo-600 py-1 text-center text-sm font-semibold text-white dark:bg-indigo-500">
                    Recommended
                  </div>
                )}
                <h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">
                  {plan.name}
                </h3>
                <div class="mb-4">
                  <span class="text-4xl font-bold text-gray-900 dark:text-white">
                    ${plan.price}
                  </span>
                  <span class="text-gray-600 dark:text-gray-400">/month</span>
                </div>
                <ul class="mb-8 space-y-3 text-gray-600 dark:text-gray-300">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <a
                  href="#pricing"
                  class={`block w-full rounded-lg px-4 py-2 text-center font-semibold ${
                    plan.recommended
                      ? "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                      : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  Get Started
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section class="bg-indigo-600 py-20 dark:bg-indigo-500">
        <div class="container mx-auto px-4 text-center">
          <h2 class="mb-6 text-3xl font-bold text-white">
            Ready to streamline your content management?
          </h2>
          <a
            href="#pricing"
            class="inline-block rounded-lg bg-white px-6 py-3 text-lg font-semibold text-indigo-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-indigo-400 dark:hover:bg-gray-700"
          >
            Get started today
          </a>
        </div>
      </section>
    </main>
  );
});
