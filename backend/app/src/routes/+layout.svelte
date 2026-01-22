<script lang="ts">
  import Footer from "$lib/components/Footer.svelte";
  import Header from "$lib/components/Header.svelte";
  import { ModeWatcher } from "mode-watcher";
  import "../app.css";

  let { data, children } = $props();
</script>

<ModeWatcher modeStorageKey="theme" defaultMode="system" />
<div class="flex min-h-screen flex-col">
  <Header user={data.user} isUnderConstruction={data.isUnderConstruction} />
  <main class="flex-1">{@render children()}</main>
  <Footer />
</div>
