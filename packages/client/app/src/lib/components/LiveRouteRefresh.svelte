<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount } from "svelte";

  function isLiveRefreshRoute(pathname: string): boolean {
    return (
      pathname === "/" ||
      pathname === "/items" ||
      pathname.startsWith("/items/") ||
      pathname === "/collections" ||
      pathname.startsWith("/collections/")
    );
  }

  function refreshIfInScope() {
    if (!isLiveRefreshRoute(page.url.pathname)) return;
    void invalidateAll();
  }

  onMount(() => {
    const eventSource = new EventSource("/api/live");

    const onSyncStatus = () => {
      refreshIfInScope();
    };

    const onDataChangedBatch = () => {
      refreshIfInScope();
    };

    eventSource.addEventListener("sync-status", onSyncStatus);
    eventSource.addEventListener("data-changed-batch", onDataChangedBatch);

    return () => {
      eventSource.removeEventListener("sync-status", onSyncStatus);
      eventSource.removeEventListener("data-changed-batch", onDataChangedBatch);
      eventSource.close();
    };
  });
</script>

