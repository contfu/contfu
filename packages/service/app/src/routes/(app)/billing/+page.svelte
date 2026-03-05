<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import SiteHeader from "$lib/components/layout/site-header.svelte";
  import { Button } from "$lib/components/ui/button";
  import { getQuota } from "$lib/remote/billing.remote";
  import { CreditCardIcon } from "@lucide/svelte";

  const quota = await getQuota();

  async function handleCheckout(productId: string) {
    const result = await authClient.checkout({ productId });
    if (result.data?.url) {
      window.location.href = result.data.url;
    }
  }

  async function openCustomerPortal() {
    const result = await authClient.customer.portal();
    if (result.data?.url) {
      window.location.href = result.data.url;
    }
  }

  function progressWidth(current: number, max: number): string {
    return `${Math.min(100, (current / max) * 100)}%`;
  }
</script>

<SiteHeader icon={CreditCardIcon} title="billing" />

<div class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
  <p class="mb-8 text-xs text-muted-foreground">
    <span class="text-primary">$</span> contfu billing --status
  </p>

  {#if quota?.subscriptionStatus === "active"}
    <!-- Current subscription -->
    <section class="mb-8">
      <h2
        class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground"
      >
        Current Plan
      </h2>
      <div class="rounded-lg border border-border p-4">
        <div class="flex items-center justify-between">
          <div>
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1.5 text-sm">
                <span class="h-1.5 w-1.5 rounded-full bg-success"></span>
                Active
              </span>
            </div>
            {#if quota.currentPeriodEnd}
              <p class="mt-1 text-sm text-muted-foreground">
                Renews {quota.currentPeriodEnd.toLocaleDateString()}
              </p>
            {/if}
          </div>
          <Button variant="outline" onclick={openCustomerPortal}>Manage</Button>
        </div>
      </div>
    </section>
  {/if}

  <!-- Usage -->
  <section class="mb-8">
    <h2
      class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground"
    >
      Usage
    </h2>
    <div class="space-y-4 rounded-lg border border-border p-4">
      <div>
        <div class="mb-1.5 flex justify-between text-sm">
          <span>Sources</span>
          <span class="font-mono"
            >{quota?.sources ?? 0} / {quota?.maxSources ?? 1}</span
          >
        </div>
        <div class="h-1.5 w-full rounded-full bg-secondary">
          <div
            class="h-1.5 rounded-full bg-primary transition-all"
            style="width: {progressWidth(
              quota?.sources ?? 0,
              quota?.maxSources ?? 1,
            )}"
          ></div>
        </div>
      </div>
      <div>
        <div class="mb-1.5 flex justify-between text-sm">
          <span>Collections</span>
          <span class="font-mono"
            >{quota?.collections ?? 0} / {quota?.maxCollections ??
              5}</span
          >
        </div>
        <div class="h-1.5 w-full rounded-full bg-secondary">
          <div
            class="h-1.5 rounded-full bg-primary transition-all"
            style="width: {progressWidth(
              quota?.collections ?? 0,
              quota?.maxCollections ?? 5,
            )}"
          ></div>
        </div>
      </div>
      <div>
        <div class="mb-1.5 flex justify-between text-sm">
          <span>Items</span>
          <span class="font-mono"
            >{quota?.items ?? 0} / {quota?.maxItems ?? 100}</span
          >
        </div>
        <div class="h-1.5 w-full rounded-full bg-secondary">
          <div
            class="h-1.5 rounded-full bg-primary transition-all"
            style="width: {progressWidth(
              quota?.items ?? 0,
              quota?.maxItems ?? 100,
            )}"
          ></div>
        </div>
      </div>
      <div>
        <div class="mb-1.5 flex justify-between text-sm">
          <span>Consumers</span>
          <span class="font-mono"
            >{quota?.consumers ?? 0} / {quota?.maxConsumers ??
              1}</span
          >
        </div>
        <div class="h-1.5 w-full rounded-full bg-secondary">
          <div
            class="h-1.5 rounded-full bg-primary transition-all"
            style="width: {progressWidth(
              quota?.consumers ?? 0,
              quota?.maxConsumers ?? 1,
            )}"
          ></div>
        </div>
      </div>
    </div>
  </section>

  <!-- Plans -->
  <section>
    <h2
      class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground"
    >
      Plans
    </h2>
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="rounded-lg border border-border p-5">
        <h3 class="font-semibold">Pro</h3>
        <p class="mt-1 text-sm text-muted-foreground">For growing teams</p>
        <ul class="mt-4 space-y-1.5 text-sm text-muted-foreground">
          <li>10 sources</li>
          <li>50 collections</li>
          <li>10,000 items</li>
          <li>5 consumers</li>
        </ul>
        <Button
          onclick={() => handleCheckout("pro_product_id")}
          class="mt-4 w-full"
        >
          {quota?.subscriptionStatus === "active" ? "Switch" : "Upgrade"}
        </Button>
      </div>

      <div class="rounded-lg border border-border p-5">
        <h3 class="font-semibold">Enterprise</h3>
        <p class="mt-1 text-sm text-muted-foreground">For large deployments</p>
        <ul class="mt-4 space-y-1.5 text-sm text-muted-foreground">
          <li>100 sources</li>
          <li>500 collections</li>
          <li>100,000 items</li>
          <li>50 consumers</li>
        </ul>
        <Button
          onclick={() => handleCheckout("enterprise_product_id")}
          class="mt-4 w-full"
        >
          {quota?.subscriptionStatus === "active" ? "Switch" : "Upgrade"}
        </Button>
      </div>
    </div>
  </section>
</div>
