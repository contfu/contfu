<script lang="ts">
  import { ModeWatcher } from "mode-watcher";
  import "../app.css";

  let { children } = $props();
</script>

<ModeWatcher modeStorageKey="theme" defaultMode="system" />
<div class="flex min-h-screen flex-col">
  <main class="flex-1">{@render children()}</main>
</div>
