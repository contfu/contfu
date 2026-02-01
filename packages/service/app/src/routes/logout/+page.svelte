<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { signOut } from "$lib/auth-client";

  async function handleLogout() {
    await signOut();
    await invalidateAll();
    goto("/login");
  }
</script>

<div class="flex min-h-screen items-center justify-center">
  <button type="button" onclick={handleLogout} class="text-primary hover:underline">
    Click here to logout
  </button>
</div>
