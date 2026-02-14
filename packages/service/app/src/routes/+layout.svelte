<script lang="ts">
  import Footer from "$lib/components/Footer.svelte";
  import Header from "$lib/components/Header.svelte";
  import { buttonVariants } from "$lib/components/ui/button";
  import { mode, ModeWatcher } from "mode-watcher";
  import { Toaster } from "svelte-sonner";
  import "../app.css";

  let { data, children } = $props();
</script>

<Toaster
  duration={3000}
  position="bottom-center"
  richColors
  closeButton
  theme={mode.current}
  toastOptions={{
    actionButtonStyle: "",
    classes: {
      actionButton: buttonVariants({ variant: "outline", size: "sm" }),
    },
  }}
/>
<ModeWatcher modeStorageKey="theme" defaultMode="system" />
{#if data.user}
  {@render children()}
{:else}
  <div class="flex min-h-screen flex-col">
    <Header user={data.user} isUnderConstruction={data.isUnderConstruction} />
    <main class="flex-1">{@render children()}</main>
    <Footer />
  </div>
{/if}
