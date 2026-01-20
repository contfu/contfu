<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Tabs from "$lib/components/ui/tabs";
  import { cn } from "$lib/utils";

  let { data } = $props();
  let isYearly = $state(true);

  const features = [
    {
      icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />`,
      title: "Connect Any CMS",
      description:
        "Notion, Strapi, Contentful, Sanity - sync them all to one database. Add new sources in minutes, not days.",
    },
    {
      icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />`,
      title: "Real-Time Updates",
      description:
        "Content changes stream to your apps instantly. No polling. No stale data. Sub-second propagation.",
    },
    {
      icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />`,
      title: "One Schema, Every Source",
      description:
        "Query all your content with a single, predictable structure. No more mapping between incompatible APIs.",
    },
    {
      icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />`,
      title: "Migrate Gradually",
      description:
        "Switch CMS platforms without rewriting your apps. Run multiple sources in parallel and migrate content at your own pace.",
    },
  ];

  const plans = [
    {
      name: "Free",
      monthlyPrice: 0,
      yearlyPrice: 0,
      monthlySlug: null,
      yearlySlug: null,
      features: ["1 data source", "5 collections", "1000 items", "1 consumer"],
      recommended: false,
    },
    {
      name: "Starter",
      monthlyPrice: 6,
      yearlyPrice: Math.round(6 * 12 * 0.85 * 100) / 100,
      monthlySlug: "starter/monthly",
      yearlySlug: "starter/yearly",
      features: [
        "3 data sources",
        "15 collections",
        "10,000 items",
        "2 consumers",
      ],
      recommended: false,
    },
    {
      name: "Pro",
      monthlyPrice: 25,
      yearlyPrice: Math.round(25 * 12 * 0.85 * 100) / 100,
      monthlySlug: "pro/monthly",
      yearlySlug: "pro/yearly",
      features: [
        "10 data sources",
        "50 collections",
        "100,000 items",
        "5 consumers",
        "Priority support",
      ],
      recommended: true,
    },
    {
      name: "Business",
      monthlyPrice: 100,
      yearlyPrice: Math.round(100 * 12 * 0.85 * 100) / 100,
      monthlySlug: "business/monthly",
      yearlySlug: "business/yearly",
      features: [
        "100 data sources",
        "500 collections",
        "1,000,000 items",
        "50 consumers",
        "Dedicated support",
        "Custom integrations",
      ],
      recommended: false,
    },
  ];

  async function handleCheckout(slug: string) {
    await authClient.checkout({ slug });
  }

  function dollars(amount: number) {
    return amount.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
  }
</script>

<main class="bg-gray-100 dark:bg-gray-900">
  <!-- Hero Section -->
  <section
    class="min-h-screen flex items-center justify-center bg-linear-to-b from-white to-gray-100 py-40 dark:from-gray-950 dark:to-gray-900"
  >
    <div class="container mx-auto px-4">
      <div class="mx-auto max-w-4xl text-center">
        <h1
          class="mb-6 text-5xl font-bold tracking-tight text-gray-900 dark:text-white"
        >
          Query Any CMS in Milliseconds
        </h1>
        <p class="mb-10 text-xl text-gray-600 dark:text-gray-300">
          Sync content from Notion, Strapi, and more into a local SQLite
          database. Build faster apps with instant content access and zero API
          rate limits.
        </p>
        <div class="flex justify-center gap-4">
          <a
            href="#pricing"
            class="bg-primary-400 hover:bg-primary-500 dark:bg-primary-500 dark:hover:bg-primary-400 rounded-lg px-6 py-3 text-lg font-semibold text-white"
          >
            Start Free
          </a>
          <a
            href="#how-it-works"
            class="rounded-lg border border-gray-300 bg-white px-6 py-3 text-lg font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            See How It Works
          </a>
        </div>
      </div>
    </div>
  </section>

  <!-- What is Contfu Section -->
  <section
    id="how-it-works"
    class="py-20 md:py-40 bg-linear-to-b from-gray-100 to-white dark:from-gray-900 dark:to-gray-950"
  >
    <div class="container mx-auto px-4">
      <div class="mx-auto max-w-4xl text-center">
        <h2 class="mb-4 text-3xl font-bold text-gray-900 dark:text-white">
          Your Content. One Database. Zero Latency.
        </h2>
        <p class="mb-12 text-lg text-gray-600 dark:text-gray-300">
          Stop juggling multiple CMS APIs. Contfu syncs your Notion, Strapi, and
          other content sources into a single, lightning-fast local database
          that your applications can query instantly.
        </p>

        <!-- Architecture Diagram -->
        <div class="mb-12">
          <svg
            viewBox="0 0 600 420"
            class="mx-auto w-full max-w-2xl"
            xmlns="http://www.w3.org/2000/svg"
          >
            <!-- Definitions -->
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
              </marker>
              <marker
                id="arrowhead-swap"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#22c55e" />
              </marker>
              <!-- Gradient for database -->
              <linearGradient
                id="db-gradient"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" style="stop-color:#60a5fa;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
              </linearGradient>
              <linearGradient
                id="db-gradient-dark"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" style="stop-color:#1e40af;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#1e3a8a;stop-opacity:1" />
              </linearGradient>
            </defs>

            <!-- Swap indicator label -->
            <text
              x="300"
              y="12"
              text-anchor="middle"
              class="fill-green-600 dark:fill-green-400"
              style="font-size: 10px; font-weight: 500;"
            >
              Swap anytime - migrate gradually
            </text>

            <!-- CMS Sources Row with swap arrows -->
            <g class="cms-sources">
              <!-- Swap arrows between CMS boxes -->
              <g class="swap-arrows">
                <!-- Arrow from Notion to Strapi -->
                <path
                  d="M 145 40 C 180 25, 220 25, 255 40"
                  fill="none"
                  stroke="#22c55e"
                  stroke-width="1.5"
                  stroke-dasharray="4"
                  marker-end="url(#arrowhead-swap)"
                />
                <!-- Arrow from Strapi to More -->
                <path
                  d="M 345 40 C 380 25, 420 25, 455 40"
                  fill="none"
                  stroke="#22c55e"
                  stroke-width="1.5"
                  stroke-dasharray="4"
                  marker-end="url(#arrowhead-swap)"
                />
              </g>

              <!-- Notion -->
              <g transform="translate(100, 50)">
                <rect
                  x="-40"
                  y="-20"
                  width="80"
                  height="40"
                  rx="8"
                  class="fill-white dark:fill-gray-700"
                  stroke="#d1d5db"
                  stroke-width="2"
                />
                <text
                  x="0"
                  y="5"
                  text-anchor="middle"
                  class="fill-gray-700 dark:fill-gray-200"
                  style="font-size: 13px; font-weight: 500;"
                >
                  Notion
                </text>
              </g>
              <!-- Strapi -->
              <g transform="translate(300, 50)">
                <rect
                  x="-40"
                  y="-20"
                  width="80"
                  height="40"
                  rx="8"
                  class="fill-white dark:fill-gray-700"
                  stroke="#d1d5db"
                  stroke-width="2"
                />
                <text
                  x="0"
                  y="5"
                  text-anchor="middle"
                  class="fill-gray-700 dark:fill-gray-200"
                  style="font-size: 13px; font-weight: 500;"
                >
                  Strapi
                </text>
              </g>
              <!-- More Sources -->
              <g transform="translate(500, 50)">
                <rect
                  x="-40"
                  y="-20"
                  width="80"
                  height="40"
                  rx="8"
                  class="fill-gray-50 dark:fill-gray-800"
                  stroke="#9ca3af"
                  stroke-width="2"
                  stroke-dasharray="4"
                />
                <text
                  x="0"
                  y="5"
                  text-anchor="middle"
                  class="fill-gray-500 dark:fill-gray-400"
                  style="font-size: 13px; font-weight: 500;"
                >
                  + More
                </text>
              </g>
            </g>

            <!-- Arrows from CMS to Contfu -->
            <g class="arrows-down">
              <line
                x1="100"
                y1="75"
                x2="250"
                y2="135"
                stroke="#9ca3af"
                stroke-width="2"
                marker-end="url(#arrowhead)"
              />
              <line
                x1="300"
                y1="75"
                x2="300"
                y2="135"
                stroke="#9ca3af"
                stroke-width="2"
                marker-end="url(#arrowhead)"
              />
              <line
                x1="500"
                y1="75"
                x2="350"
                y2="135"
                stroke="#9ca3af"
                stroke-width="2"
                marker-end="url(#arrowhead)"
              />
            </g>

            <!-- Contfu Sync Service - High contrast design -->
            <g transform="translate(300, 175)">
              <!-- Main box -->
              <rect
                x="-100"
                y="-35"
                width="200"
                height="70"
                rx="12"
                stroke="#44acbc"
                fill="none"
                stroke-width="2"
              />
              <image
                x="-80"
                y="-30"
                width="40"
                height="40"
                href="/favicon.svg"
              />
              <!-- Contfu text -->
              <text
                x="0"
                y="-5"
                text-anchor="middle"
                fill="#44acbc"
                style="font-size: 18px; font-weight: 700;"
              >
                Contfu
              </text>
              <!-- Sync indicator -->
              <g transform="translate(0, 18)">
                <circle cx="-50" cy="0" r="4" fill="#4ade80">
                  <animate
                    attributeName="opacity"
                    values="1;0.4;1"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                </circle>
                <text
                  x="0"
                  y="4"
                  text-anchor="middle"
                  class="fill-fg dark:fill-gray-100"
                  style="font-size: 11px; font-weight: 500;"
                >
                  Real-time Sync
                </text>
              </g>
            </g>

            <!-- Arrow from Contfu to Database -->
            <g class="arrows-down">
              <line
                x1="300"
                y1="215"
                x2="300"
                y2="260"
                stroke="#9ca3af"
                stroke-width="2"
                marker-end="url(#arrowhead)"
              />
            </g>

            <!-- SQLite Database - 3D cylinder with logo -->
            <g transform="translate(300, 310)">
              <!-- Database cylinder body -->
              <ellipse
                cx="0"
                cy="-35"
                rx="65"
                ry="18"
                class="fill-blue-400 dark:fill-blue-700"
              />
              <rect
                x="-65"
                y="-35"
                width="130"
                height="55"
                class="fill-blue-500 dark:fill-blue-600"
              />
              <!-- Middle ring for 3D effect -->
              <ellipse
                cx="0"
                cy="-10"
                rx="65"
                ry="18"
                class="fill-blue-400 dark:fill-blue-700"
                opacity="0.3"
              />
              <!-- Side edges -->
              <line
                x1="-65"
                y1="-35"
                x2="-65"
                y2="20"
                stroke="#2563eb"
                stroke-width="2"
              />
              <line
                x1="65"
                y1="-35"
                x2="65"
                y2="20"
                stroke="#2563eb"
                stroke-width="2"
              />
              <!-- Bottom ellipse -->
              <ellipse
                cx="0"
                cy="20"
                rx="65"
                ry="18"
                class="fill-blue-600 dark:fill-blue-800"
              />
              <ellipse
                cx="0"
                cy="20"
                rx="65"
                ry="18"
                fill="none"
                stroke="#2563eb"
                stroke-width="2"
              />
              <!-- Top ellipse stroke -->
              <ellipse
                cx="0"
                cy="-35"
                rx="65"
                ry="18"
                fill="none"
                stroke="#2563eb"
                stroke-width="2"
              />
              <!-- SQLite logo/text -->
              <path
                class="fill-white"
                transform="scale(2) translate(-30, -20)"
                d="M21.678.521c-1.032-.92-2.28-.55-3.513.544a8.71 8.71 0 0 0-.547.535c-2.109 2.237-4.066 6.38-4.674 9.544.237.48.422 1.093.544 1.561a13.044 13.044 0 0 1 .164.703s-.019-.071-.096-.296l-.05-.146a1.689 1.689 0 0 0-.033-.08c-.138-.32-.518-.995-.686-1.289-.143.423-.27.818-.376 1.176.484.884.778 2.4.778 2.4s-.025-.099-.147-.442c-.107-.303-.644-1.244-.772-1.464-.217.804-.304 1.346-.226 1.478.152.256.296.698.422 1.186.286 1.1.485 2.44.485 2.44l.017.224a22.41 22.41 0 0 0 .056 2.748c.095 1.146.273 2.13.5 2.657l.155-.084c-.334-1.038-.47-2.399-.41-3.967.09-2.398.642-5.29 1.661-8.304 1.723-4.55 4.113-8.201 6.3-9.945-1.993 1.8-4.692 7.63-5.5 9.788-.904 2.416-1.545 4.684-1.931 6.857.666-2.037 2.821-2.912 2.821-2.912s1.057-1.304 2.292-3.166c-.74.169-1.955.458-2.362.629-.6.251-.762.337-.762.337s1.945-1.184 3.613-1.72C21.695 7.9 24.195 2.767 21.678.521m-18.573.543A1.842 1.842 0 0 0 1.27 2.9v16.608a1.84 1.84 0 0 0 1.835 1.834h9.418a22.953 22.953 0 0 1-.052-2.707c-.006-.062-.011-.141-.016-.2a27.01 27.01 0 0 0-.473-2.378c-.121-.47-.275-.898-.369-1.057-.116-.197-.098-.31-.097-.432 0-.12.015-.245.037-.386a9.98 9.98 0 0 1 .234-1.045l.217-.028c-.017-.035-.014-.065-.031-.097l-.041-.381a32.8 32.8 0 0 1 .382-1.194l.2-.019c-.008-.016-.01-.038-.018-.053l-.043-.316c.63-3.28 2.587-7.443 4.8-9.791.066-.069.133-.128.198-.194Z"
              />
              <text
                x="10"
                y="-5"
                text-anchor="middle"
                fill="white"
                style="font-size: 14px; font-weight: 700;"
              >
                SQLite
              </text>
              <text
                x="10"
                y="14"
                text-anchor="middle"
                fill="white"
                opacity="0.8"
                style="font-size: 9px;"
              >
                Local Database
              </text>
            </g>

            <!-- Arrows from Database to Apps -->
            <g class="arrows-down">
              <line
                x1="250"
                y1="345"
                x2="120"
                y2="375"
                stroke="#9ca3af"
                stroke-width="2"
                marker-end="url(#arrowhead)"
              />
              <line
                x1="300"
                y1="350"
                x2="300"
                y2="375"
                stroke="#9ca3af"
                stroke-width="2"
                marker-end="url(#arrowhead)"
              />
              <line
                x1="350"
                y1="345"
                x2="480"
                y2="375"
                stroke="#9ca3af"
                stroke-width="2"
                marker-end="url(#arrowhead)"
              />
            </g>

            <!-- App Icons Row -->
            <g class="apps">
              <!-- Website -->
              <g transform="translate(100, 395)">
                <rect
                  x="-35"
                  y="-15"
                  width="70"
                  height="30"
                  rx="6"
                  class="fill-gray-100 dark:fill-gray-700"
                  stroke="#d1d5db"
                  stroke-width="1"
                />
                <text
                  x="0"
                  y="4"
                  text-anchor="middle"
                  class="fill-gray-600 dark:fill-gray-300"
                  style="font-size: 11px; font-weight: 500;"
                >
                  Website
                </text>
              </g>
              <!-- Mobile -->
              <g transform="translate(300, 395)">
                <rect
                  x="-35"
                  y="-15"
                  width="70"
                  height="30"
                  rx="6"
                  class="fill-gray-100 dark:fill-gray-700"
                  stroke="#d1d5db"
                  stroke-width="1"
                />
                <text
                  x="0"
                  y="4"
                  text-anchor="middle"
                  class="fill-gray-600 dark:fill-gray-300"
                  style="font-size: 11px; font-weight: 500;"
                >
                  Mobile App
                </text>
              </g>
              <!-- Docs -->
              <g transform="translate(500, 395)">
                <rect
                  x="-35"
                  y="-15"
                  width="70"
                  height="30"
                  rx="6"
                  class="fill-gray-100 dark:fill-gray-700"
                  stroke="#d1d5db"
                  stroke-width="1"
                />
                <text
                  x="0"
                  y="4"
                  text-anchor="middle"
                  class="fill-gray-600 dark:fill-gray-300"
                  style="font-size: 11px; font-weight: 500;"
                >
                  Docs Site
                </text>
              </g>
            </g>
          </svg>
        </div>

        <!-- Benefit Pills -->
        <div class="flex flex-wrap justify-center gap-3">
          <span
            class="rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
          >
            Local-First Speed
          </span>
          <span
            class="rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
          >
            One Unified API
          </span>
          <span
            class="rounded-full bg-purple-100 px-4 py-2 text-sm font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200"
          >
            Always Available
          </span>
          <span
            class="rounded-full bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200"
          >
            Zero Vendor Lock-in
          </span>
        </div>
      </div>
    </div>
  </section>

  <!-- CMS Logo Strip -->
  <section class="py-12 bg-white dark:bg-gray-950">
    <div class="container mx-auto px-4">
      <p
        class="mb-8 text-center text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
      >
        Works with your favorite CMS
      </p>
      <div class="flex flex-wrap items-center justify-center gap-8 md:gap-12">
        <!-- Notion -->
        <div class="flex flex-col items-center gap-2">
          <div
            class="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"
          >
            <svg
              role="img"
              viewBox="0 0 24 24"
              class="h-8 w-8"
              fill="currentColor"
              ><title>Notion</title><path
                d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"
              /></svg
            >
          </div>
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300"
            >Notion</span
          >
        </div>
        <!-- Strapi -->
        <div class="flex flex-col items-center gap-2">
          <div
            class="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"
          >
            <svg
              role="img"
              viewBox="0 0 24 24"
              class="h-8 w-8"
              fill="currentColor"
              ><title>Strapi</title><path
                d="M8.32 0c-3.922 0-5.882 0-7.1 1.219C0 2.438 0 4.399 0 8.32v7.36c0 3.922 0 5.882 1.219 7.101C2.438 24 4.399 24 8.32 24h7.36c3.922 0 5.882 0 7.101-1.219C24 21.562 24 19.601 24 15.68V8.32c0-3.922 0-5.882-1.219-7.101C21.562 0 19.601 0 15.68 0H8.32zm.41 7.28h7.83a.16.16 0 0 1 .16.16v7.83h-3.87v-3.71a.41.41 0 0 0-.313-.398l-.086-.012h-3.72V7.28zm-.5.25v3.87H4.553a.08.08 0 0 1-.057-.136L8.23 7.529zm.25 4.12h3.87v3.87H8.64a.16.16 0 0 1-.16-.16v-3.71zm4.12 4.12h3.87l-3.734 3.734a.08.08 0 0 1-.136-.057V15.77z"
              /></svg
            >
          </div>
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300"
            >Strapi</span
          >
        </div>
        <!-- Contentful (Coming Soon) -->
        <div class="flex flex-col items-center gap-2 opacity-50">
          <div
            class="relative flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"
          >
            <svg
              role="img"
              viewBox="0 0 24 24"
              class="size-8"
              fill="currentColor"
              ><title>Storyblok</title>
              <path
                d="M13.953 11.462H9.088v2.34h4.748c.281 0 .538-.118.749-.305.187-.187.304-.468.304-.819a1.404 1.404 0 0 0-.257-.842c-.188-.234-.398-.374-.679-.374zm.164-2.83c.21-.14.304-.445.304-.843 0-.35-.094-.608-.257-.771a.935.935 0 0 0-.608-.234H9.088v2.105h4.374c.234 0 .468-.117.655-.257zM21.251 0H2.89c-.585 0-1.053.468-1.053 1.03v18.385c0 .562.468.912 1.03.912H5.58V24l3.368-3.65h12.304c.562 0 .913-.35.913-.935V1.053c0-.562-.351-1.03-.936-1.03zm-3.087 14.9a2.827 2.827 0 0 1-1.006 1.03c-.445.28-.936.538-1.497.655-.562.14-1.17.257-1.801.257H5.579v-13.1h9.403c.468 0 .866.094 1.24.305.351.187.679.444.936.748.524.64.806 1.443.795 2.27 0 .608-.164 1.192-.468 1.754a2.924 2.924 0 0 1-1.403 1.263c.748.21 1.333.585 1.778 1.123.42.561.631 1.286.631 2.199 0 .584-.117 1.076-.35 1.497z"
              /></svg
            >
            <span
              class="absolute -bottom-1 -right-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white"
              >Q2</span
            >
          </div>
          <span class="text-sm font-medium text-gray-500 dark:text-gray-500"
            >Storyblok</span
          >
        </div>
        <!-- Sanity (Coming Soon) -->
        <div class="flex flex-col items-center gap-2 opacity-50">
          <div
            class="relative flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"
          >
            <svg
              role="img"
              viewBox="0 0 24 24"
              class="size-8"
              fill="currentColor"
              ><title>WordPress</title><path
                d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C4.911 3.15 8.235 1.215 12 1.215c2.809 0 5.365 1.072 7.286 2.833-.046-.003-.091-.009-.141-.009-1.06 0-1.812.923-1.812 1.914 0 .89.513 1.643 1.06 2.531.411.72.89 1.643.89 2.977 0 .915-.354 1.994-.821 3.479l-1.075 3.585-3.9-11.61.001.014zM12 22.784c-1.059 0-2.081-.153-3.048-.437l3.237-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.325.609-3.582.609M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.96 1.212 16.271 1.211 12M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0"
              /></svg
            >
            <span
              class="absolute -bottom-1 -right-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white"
              >Q2</span
            >
          </div>
          <span class="text-sm font-medium text-gray-500 dark:text-gray-500"
            >WordPress</span
          >
        </div>
      </div>
    </div>
  </section>

  <!-- Features Section -->
  <section
    id="features"
    class="py-20 md:py-40 bg-linear-to-b from-white to-gray-100 dark:from-gray-950 dark:to-gray-900"
  >
    <div class="container mx-auto px-4">
      <h2
        class="mb-12 text-center text-3xl font-bold text-gray-900 dark:text-white"
      >
        Why Choose Contfu?
      </h2>
      <div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
        {#each features as feature}
          <div class="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
            <div
              class="bg-primary-100 dark:bg-primary-900 mb-4 flex h-12 w-12 items-center justify-center rounded-full p-3"
            >
              <svg
                class="text-primary-600 dark:text-primary-400 h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {@html feature.icon}
              </svg>
            </div>
            <h3
              class="mb-2 text-xl font-semibold text-gray-900 dark:text-white"
            >
              {feature.title}
            </h3>
            <p class="text-gray-600 dark:text-gray-300">
              {feature.description}
            </p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Pricing Section -->
  <section id="pricing" class="py-20 md:py-40">
    <div class="container mx-auto px-4">
      <h2
        class="mb-12 text-center text-3xl font-bold text-gray-900 dark:text-white"
      >
        Simple, transparent pricing
      </h2>
      <p class="mb-8 text-center text-gray-600 dark:text-gray-300">
        All paid plans come with a 7-day free trial.
      </p>
      <Tabs.Root value={isYearly ? "yearly" : "monthly"}>
        <Tabs.List class="self-center h-12 mb-4">
          <Tabs.Trigger value="monthly" class="text-lg">Monthly</Tabs.Trigger>
          <Tabs.Trigger value="yearly" class="text-lg"
            >Yearly <span class="text-sm text-green-600">(Save 15%)</span
            ></Tabs.Trigger
          >
        </Tabs.List>
        {#each ["monthly", "yearly"] as tab}
          <Tabs.Content value={tab}>
            <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {#each plans as plan}
                {@const price =
                  tab === "monthly" ? plan.monthlyPrice : plan.yearlyPrice}
                {@const monthlyEquivalent =
                  tab === "monthly"
                    ? plan.monthlyPrice
                    : Math.round((plan.yearlyPrice / 12) * 100) / 100}
                {@const slug = isYearly ? plan.yearlySlug : plan.monthlySlug}
                <div
                  class={cn(
                    "rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800 flex flex-col",
                    plan.recommended
                      ? "shadow-lg ring-2 ring-primary-500 dark:ring-primary-900"
                      : "shadow-sm",
                  )}
                >
                  <div class="mb-4 flex items-center justify-between">
                    <h3 class="text-xl font-bold text-gray-900 dark:text-white">
                      {plan.name}
                    </h3>
                    {#if tab === "yearly"}
                      <span
                        class="text-md font-bold text-gray-500 dark:text-gray-400 line-through"
                      >
                        {price === 0 ? "" : dollars(plan.monthlyPrice)}
                      </span>
                    {/if}
                  </div>
                  <div class="mb-2">
                    <span
                      class="text-4xl font-bold text-gray-900 dark:text-white"
                    >
                      {price === 0 ? "Free" : dollars(monthlyEquivalent)}
                    </span>
                    <span class="text-gray-600 dark:text-gray-400">/month</span>
                  </div>
                  {#if tab === "yearly"}
                    <div class="text-sm text-gray-500 dark:text-gray-400">
                      {price === 0
                        ? "Forever Free"
                        : `Billed ${dollars(price)}/year`}
                    </div>
                  {/if}
                  <ul
                    class="my-2 mb-8 space-y-3 text-gray-600 dark:text-gray-300 flex-1"
                  >
                    {#each plan.features as feature}
                      <li class="flex items-start gap-2">
                        <svg
                          class="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span>{feature}</span>
                      </li>
                    {/each}
                  </ul>
                  {#if slug && data.user}
                    <Button
                      onclick={() => handleCheckout(slug)}
                      class="block w-full rounded-lg px-4 py-2 text-center font-semibold bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white"
                    >
                      Subscribe
                    </Button>
                  {:else}
                    <Button
                      href="/register"
                      class="block w-full rounded-lg px-4 py-2 text-center font-semibold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Get Started
                    </Button>
                  {/if}
                </div>
              {/each}
            </div>
          </Tabs.Content>
        {/each}
      </Tabs.Root>
    </div>
  </section>

  <!-- CTA Section -->
  <section class="py-20 md:py-40">
    <div class="container mx-auto px-4 text-center">
      <h2 class="mb-6 text-3xl font-bold text-gray-900 dark:text-white">
        Ship Faster. Query Content Instantly.
      </h2>
      <a
        href="/register"
        class="bg-primary-400 hover:bg-primary-500 dark:bg-primary-500 dark:hover:bg-primary-400 inline-block rounded-lg px-6 py-3 text-lg font-semibold text-white"
      >
        Create Free Account
      </a>
    </div>
  </section>
</main>
