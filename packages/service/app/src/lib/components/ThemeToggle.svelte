<script lang="ts">
  import { MoonIcon, SunIcon } from "@lucide/svelte";
  import { mode, setMode } from "mode-watcher";
  import Button from "./ui/button/button.svelte";
</script>

<Button
  variant="outline"
  size="icon"
  onclick={() => setMode(mode.current === "dark" ? "light" : "dark")}
>
  {#if mode.current === "dark"}
    <MoonIcon />
  {:else}
    <SunIcon />
  {/if}
</Button>
