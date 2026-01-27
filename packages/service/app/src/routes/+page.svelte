<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";
  import * as Tabs from "$lib/components/ui/tabs";

  let { data } = $props();
  let isYearly = $state(true);

  const features = [
    {
      title: "Connect Any CMS",
      description: "Notion, Strapi, Contentful — sync them all to one database. Add new sources in minutes."
    },
    {
      title: "Real-Time Updates",
      description: "Content changes stream to your apps instantly. No polling. Sub-second propagation."
    },
    {
      title: "One Schema",
      description: "Query all your content with a single, predictable structure. No more API mapping."
    },
    {
      title: "Migrate Gradually",
      description: "Switch CMS platforms without rewriting apps. Run multiple sources in parallel."
    },
  ];

  const plans = [
    {
      name: "Free",
      monthlyPrice: 0,
      features: ["1 source", "5 collections", "1,000 items/mo", "1 client"],
      slug: null,
    },
    {
      name: "Starter",
      monthlyPrice: 6,
      features: ["3 sources", "15 collections", "10,000 items/mo", "2 clients"],
      slug: "starter",
    },
    {
      name: "Pro",
      monthlyPrice: 25,
      features: ["10 sources", "50 collections", "100,000 items/mo", "5 clients", "Priority support"],
      slug: "pro",
      recommended: true,
    },
    {
      name: "Business",
      monthlyPrice: 100,
      features: ["100 sources", "500 collections", "1M items/mo", "50 clients", "Dedicated support"],
      slug: "business",
    },
  ];

  function getYearlyPrice(monthlyPrice: number) {
    return Math.round(monthlyPrice * 12 * 0.85 * 100) / 100;
  }

  async function handleCheckout(slug: string) {
    const period = isYearly ? "yearly" : "monthly";
    await authClient.checkout({ slug: `${slug}/${period}` });
  }

  function formatPrice(amount: number) {
    if (amount === 0) return "Free";
    // Show decimals only if needed
    return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
  }
</script>

<main>
  <!-- Hero -->
  <section class="border-b border-border py-20 sm:py-32">
    <div class="mx-auto max-w-3xl px-4 text-center sm:px-6">
      <h1 class="text-4xl font-semibold tracking-tight sm:text-5xl">
        Query Any CMS in Milliseconds
      </h1>
      <p class="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
        Sync content from Notion, Strapi, and more into a local SQLite database. 
        Build faster apps with instant content access and zero API limits.
      </p>
      <div class="mt-8 flex justify-center gap-3">
        <Button href="#pricing" size="lg">Start Free</Button>
        <Button href="#how-it-works" variant="outline" size="lg">How It Works</Button>
      </div>
    </div>
  </section>

  <!-- How It Works -->
  <section id="how-it-works" class="border-b border-border py-16 sm:py-24">
    <div class="mx-auto max-w-4xl px-4 sm:px-6">
      <div class="text-center">
        <h2 class="text-2xl font-semibold tracking-tight sm:text-3xl">
          Your Content. One Database. Zero Latency.
        </h2>
        <p class="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Stop juggling multiple CMS APIs. Contfu syncs your content sources into a single, 
          lightning-fast local database that your applications can query instantly.
        </p>
      </div>

      <!-- Architecture diagram -->
      <div class="mt-12">
        <div class="flex flex-col items-center gap-4">
          <!-- Sources -->
          <div class="flex flex-wrap justify-center gap-3">
            <div class="rounded-md border border-border px-4 py-2 text-sm font-medium">Notion</div>
            <div class="rounded-md border border-border px-4 py-2 text-sm font-medium">Strapi</div>
            <div class="rounded-md border border-dashed border-muted-foreground px-4 py-2 text-sm text-muted-foreground">+ More</div>
          </div>
          
          <!-- Arrow -->
          <div class="text-muted-foreground">↓</div>
          
          <!-- Contfu -->
          <div class="flex items-center gap-3 rounded-lg border-2 border-primary px-6 py-3">
            <img src="/favicon.svg" alt="" class="h-6 w-6" />
            <span class="font-semibold text-primary">Contfu</span>
            <span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-success"></span>
              Real-time sync
            </span>
          </div>
          
          <!-- Arrow -->
          <div class="text-muted-foreground">↓</div>
          
          <!-- Database -->
          <div class="rounded-lg bg-primary px-6 py-3 text-primary-foreground">
            <div class="font-semibold">SQLite</div>
            <div class="text-xs opacity-80">Local Database</div>
          </div>
          
          <!-- Arrow -->
          <div class="text-muted-foreground">↓</div>
          
          <!-- Apps -->
          <div class="flex flex-wrap justify-center gap-3">
            <div class="rounded-md border border-border bg-muted/50 px-4 py-2 text-sm">Website</div>
            <div class="rounded-md border border-border bg-muted/50 px-4 py-2 text-sm">Automation</div>
            <div class="rounded-md border border-border bg-muted/50 px-4 py-2 text-sm">Docs</div>
          </div>
        </div>
      </div>

      <!-- Benefits -->
      <div class="mt-12 flex flex-wrap justify-center gap-2">
        <span class="rounded-full border border-success/30 bg-success/10 px-3 py-1 text-sm font-medium text-success">
          Local-First Speed
        </span>
        <span class="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          One Unified API
        </span>
        <span class="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-600 dark:text-amber-400">
          Always Available
        </span>
      </div>
    </div>
  </section>

  <!-- CMS logos -->
  <section class="border-b border-border py-12">
    <div class="mx-auto max-w-4xl px-4 sm:px-6">
      <p class="mb-6 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Works with your favorite CMS
      </p>
      <div class="flex flex-wrap items-center justify-center gap-8">
        <div class="flex flex-col items-center gap-2">
          <div class="flex h-12 w-12 items-center justify-center rounded-lg border border-border">
            <svg role="img" viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor"><title>Notion</title><path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/></svg>
          </div>
          <span class="text-xs font-medium">Notion</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <div class="flex h-12 w-12 items-center justify-center rounded-lg border border-border">
            <svg role="img" viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor"><title>Strapi</title><path d="M8.32 0c-3.922 0-5.882 0-7.1 1.219C0 2.438 0 4.399 0 8.32v7.36c0 3.922 0 5.882 1.219 7.101C2.438 24 4.399 24 8.32 24h7.36c3.922 0 5.882 0 7.101-1.219C24 21.562 24 19.601 24 15.68V8.32c0-3.922 0-5.882-1.219-7.101C21.562 0 19.601 0 15.68 0H8.32zm.41 7.28h7.83a.16.16 0 0 1 .16.16v7.83h-3.87v-3.71a.41.41 0 0 0-.313-.398l-.086-.012h-3.72V7.28zm-.5.25v3.87H4.553a.08.08 0 0 1-.057-.136L8.23 7.529zm.25 4.12h3.87v3.87H8.64a.16.16 0 0 1-.16-.16v-3.71zm4.12 4.12h3.87l-3.734 3.734a.08.08 0 0 1-.136-.057V15.77z"/></svg>
          </div>
          <span class="text-xs font-medium">Strapi</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <div class="flex h-12 w-12 items-center justify-center rounded-lg border border-border">
            <svg role="img" viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor"><title>Web</title><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
          </div>
          <span class="text-xs font-medium">Any URL</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <div class="relative flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-muted-foreground">
            <svg role="img" viewBox="0 0 24 24" class="h-6 w-6 text-muted-foreground" fill="currentColor"><title>Storyblok</title><path d="M13.953 11.462H9.088v2.34h4.748c.281 0 .538-.118.749-.305.187-.187.304-.468.304-.819a1.404 1.404 0 0 0-.257-.842c-.188-.234-.398-.374-.679-.374zm.164-2.83c.21-.14.304-.445.304-.843 0-.35-.094-.608-.257-.771a.935.935 0 0 0-.608-.234H9.088v2.105h4.374c.234 0 .468-.117.655-.257zM21.251 0H2.89c-.585 0-1.053.468-1.053 1.03v18.385c0 .562.468.912 1.03.912H5.58V24l3.368-3.65h12.304c.562 0 .913-.35.913-.935V1.053c0-.562-.351-1.03-.936-1.03zm-3.087 14.9a2.827 2.827 0 0 1-1.006 1.03c-.445.28-.936.538-1.497.655-.562.14-1.17.257-1.801.257H5.579v-13.1h9.403c.468 0 .866.094 1.24.305.351.187.679.444.936.748.524.64.806 1.443.795 2.27 0 .608-.164 1.192-.468 1.754a2.924 2.924 0 0 1-1.403 1.263c.748.21 1.333.585 1.778 1.123.42.561.631 1.286.631 2.199 0 .584-.117 1.076-.35 1.497z"/></svg>
            <span class="absolute -bottom-0.5 -right-0.5 rounded bg-primary/80 px-1 text-[9px] font-bold text-white">Soon</span>
          </div>
          <span class="text-xs text-muted-foreground">Storyblok</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <div class="relative flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-muted-foreground">
            <svg role="img" viewBox="0 0 24 24" class="h-6 w-6 text-muted-foreground" fill="currentColor"><title>WordPress</title><path d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C4.911 3.15 8.235 1.215 12 1.215c2.809 0 5.365 1.072 7.286 2.833-.046-.003-.091-.009-.141-.009-1.06 0-1.812.923-1.812 1.914 0 .89.513 1.643 1.06 2.531.411.72.89 1.643.89 2.977 0 .915-.354 1.994-.821 3.479l-1.075 3.585-3.9-11.61.001.014zM12 22.784c-1.059 0-2.081-.153-3.048-.437l3.237-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.325.609-3.582.609M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.96 1.212 16.271 1.211 12M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0"/></svg>
            <span class="absolute -bottom-0.5 -right-0.5 rounded bg-primary/80 px-1 text-[9px] font-bold text-white">Soon</span>
          </div>
          <span class="text-xs text-muted-foreground">WordPress</span>
        </div>
      </div>
    </div>
  </section>

  <!-- Features -->
  <section id="features" class="border-b border-border py-16 sm:py-24">
    <div class="mx-auto max-w-4xl px-4 sm:px-6">
      <h2 class="text-center text-2xl font-semibold tracking-tight sm:text-3xl">Why Contfu?</h2>
      <div class="mt-12 grid gap-8 sm:grid-cols-2">
        {#each features as feature}
          <div class="border-l-2 border-border pl-4">
            <h3 class="font-semibold">{feature.title}</h3>
            <p class="mt-1 text-sm text-muted-foreground">{feature.description}</p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Pricing -->
  <section id="pricing" class="py-16 sm:py-24">
    <div class="mx-auto max-w-5xl px-4 sm:px-6">
      <div class="text-center">
        <h2 class="text-2xl font-semibold tracking-tight sm:text-3xl">Simple pricing</h2>
        <p class="mt-2 text-muted-foreground">All paid plans include a 7-day free trial</p>
      </div>

      <Tabs.Root value={isYearly ? "yearly" : "monthly"} class="mt-8">
        <div class="flex justify-center">
          <Tabs.List>
            <Tabs.Trigger value="monthly" onclick={() => isYearly = false}>Monthly</Tabs.Trigger>
            <Tabs.Trigger value="yearly" onclick={() => isYearly = true}>
              Yearly <span class="ml-1 text-xs text-success">-15%</span>
            </Tabs.Trigger>
          </Tabs.List>
        </div>

        <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {#each plans as plan}
            {@const yearlyTotal = getYearlyPrice(plan.monthlyPrice)}
            {@const monthlyEquivalent = yearlyTotal > 0 ? Math.round(yearlyTotal / 12 * 100) / 100 : 0}
            {@const price = isYearly ? monthlyEquivalent : plan.monthlyPrice}
            <div class="relative flex flex-col rounded-lg border {plan.recommended ? 'border-primary' : 'border-border'} p-5">
              {#if plan.recommended}
                <span class="absolute -top-2.5 left-4 rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                  Recommended
                </span>
              {/if}
              <h3 class="font-semibold">{plan.name}</h3>
              <div class="mt-2">
                <span class="text-3xl font-semibold">{formatPrice(price)}</span>
                {#if price > 0}
                  <span class="text-sm text-muted-foreground">/mo</span>
                {/if}
              </div>
              {#if isYearly && yearlyTotal > 0}
                <p class="mt-1 text-xs text-muted-foreground">Billed ${yearlyTotal}/year</p>
              {/if}
              <ul class="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
                {#each plan.features as feature}
                  <li class="flex items-center gap-2">
                    <svg class="h-4 w-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                {/each}
              </ul>
              {#if plan.slug && data.user}
                <Button onclick={() => handleCheckout(plan.slug!)} class="mt-4 w-full">
                  Subscribe
                </Button>
              {:else}
                <Button href="/register" variant={plan.recommended ? "default" : "outline"} class="mt-4 w-full">
                  Get Started
                </Button>
              {/if}
            </div>
          {/each}
        </div>
      </Tabs.Root>
    </div>
  </section>

  <!-- CTA -->
  <section class="border-t border-border py-16 sm:py-24">
    <div class="mx-auto max-w-2xl px-4 text-center sm:px-6">
      <h2 class="text-2xl font-semibold tracking-tight sm:text-3xl">
        Ship Faster. Query Content Instantly.
      </h2>
      <Button href="/register" size="lg" class="mt-6">Create Free Account</Button>
    </div>
  </section>
</main>
