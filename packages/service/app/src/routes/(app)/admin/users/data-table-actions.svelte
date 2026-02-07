<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { UserRole } from "$lib/constants/user";
  import {
    approveUser,
    demoteFromAdmin,
    promoteToAdmin,
    revokeUser,
  } from "$lib/remote/admin.remote";
  import type { UserSummary } from "@contfu/svc-backend/features/admin/listUsers";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";

  let { user }: { user: UserSummary } = $props();
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button
        {...props}
        variant="ghost"
        size="icon"
        class="relative size-8 p-0"
      >
        <span class="sr-only">Open menu</span>
        <EllipsisIcon class="size-4" />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end">
    <DropdownMenu.Group>
      <DropdownMenu.Label>Actions</DropdownMenu.Label>
      {#if !user.approved}
        <form {...approveUser}>
          <input
            {...approveUser.fields?.id.as("number")}
            type="hidden"
            value={user.id}
          />
          <DropdownMenu.Item>
            <button type="submit" class="w-full text-left">
              Approve user
            </button>
          </DropdownMenu.Item>
        </form>
      {:else}
        <form {...revokeUser}>
          <input
            {...revokeUser.fields?.id.as("number")}
            type="hidden"
            value={user.id}
          />
          <DropdownMenu.Item>
            <button type="submit" class="w-full text-left">
              Revoke approval
            </button>
          </DropdownMenu.Item>
        </form>
      {/if}
    </DropdownMenu.Group>
    <DropdownMenu.Separator />
    <DropdownMenu.Group>
      <DropdownMenu.Label>Role</DropdownMenu.Label>
      {#if user.role === UserRole.ADMIN}
        <form {...demoteFromAdmin}>
          <input
            {...demoteFromAdmin.fields?.id.as("number")}
            type="hidden"
            value={user.id}
          />
          <DropdownMenu.Item>
            <button type="submit" class="w-full text-left">
              Remove admin
            </button>
          </DropdownMenu.Item>
        </form>
      {:else}
        <form {...promoteToAdmin}>
          <input
            {...promoteToAdmin.fields?.id.as("number")}
            type="hidden"
            value={user.id}
          />
          <DropdownMenu.Item>
            <button type="submit" class="w-full text-left"> Make admin </button>
          </DropdownMenu.Item>
        </form>
      {/if}
    </DropdownMenu.Group>
  </DropdownMenu.Content>
</DropdownMenu.Root>
