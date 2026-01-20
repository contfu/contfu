<script lang="ts">
  import Header from "$lib/components/Header.svelte";
  import { ModeWatcher } from "mode-watcher";
  import "../app.css";

  let { data, children } = $props();
</script>

<ModeWatcher modeStorageKey="theme" defaultMode="system" />
<Header user={data.user} isUnderConstruction={data.isUnderConstruction} />
{@render children()}
