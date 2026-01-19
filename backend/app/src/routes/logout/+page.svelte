<script lang="ts">
  import { enhance } from "$app/forms";
</script>

<div class="flex min-h-screen items-center justify-center">
  <form method="POST" use:enhance>
    <button type="submit" class="text-primary hover:underline">
      Click here to logout
    </button>
  </form>
</div>
