<script lang="ts">
  import { MoonIcon, SunIcon, SunMoonIcon } from "@lucide/svelte";
  import { userPrefersMode } from "mode-watcher";
</script>

{#if userPrefersMode.current === "dark"}
  <MoonIcon class="size-4 opacity-50" />
{:else if userPrefersMode.current === "light"}
  <SunIcon class="size-4 opacity-50" />
{:else}
  <SunMoonIcon class="size-4 opacity-50" />
{/if}
<span>Theme</span>
