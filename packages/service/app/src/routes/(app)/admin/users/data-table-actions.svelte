<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import {
    approveUser,
    demoteFromAdmin,
    getUsers,
    promoteToAdmin,
    revokeUser,
    setBasePlan,
  } from "$lib/remote/admin.remote";
  import { tcToast } from "$lib/utils/toast";
  import type { BackendUserSummary } from "@contfu/svc-backend/domain/types";
  import { UserRole } from "@contfu/svc-backend/domain/types";
  import { PlanTier } from "@contfu/svc-backend/infra/polar/products";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import { toast } from "svelte-sonner";

  const planTiers = [
    { value: PlanTier.FREE, label: "Free" },
    { value: PlanTier.STARTER, label: "Starter" },
    { value: PlanTier.PRO, label: "Pro" },
    { value: PlanTier.BUSINESS, label: "Business" },
  ];

  let { user }: { user: BackendUserSummary } = $props();

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
        <form
          {...approveUser.enhance(async ({ submit }) => {
            await tcToast(async () => {
              await submit().updates(getUsers());
              toast.success("User approved");
            });
          })}
        >
          <input
            {...approveUser.fields.id.as("number")}
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
        <form
          {...revokeUser.enhance(async ({ submit }) => {
            await tcToast(async () => {
              await submit().updates(getUsers());
              toast.success("Approval revoked");
            });
          })}
        >
          <input
            {...revokeUser.fields.id.as("number")}
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
        <form
          {...demoteFromAdmin.enhance(async ({ submit }) => {
            await tcToast(async () => {
              await submit().updates(getUsers());
              toast.success("Admin role removed");
            });
          })}
        >
          <input
            {...demoteFromAdmin.fields.id.as("number")}
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
        <form
          {...promoteToAdmin.enhance(async ({ submit }) => {
            await tcToast(async () => {
              await submit().updates(getUsers());
              toast.success("Promoted to admin");
            });
          })}
        >
          <input
            {...promoteToAdmin.fields.id.as("number")}
            type="hidden"
            value={user.id}
          />
          <DropdownMenu.Item>
            <button type="submit" class="w-full text-left">
              Make admin
            </button>
          </DropdownMenu.Item>
        </form>
      {/if}
    </DropdownMenu.Group>
    <DropdownMenu.Separator />
    <DropdownMenu.Group>
      <DropdownMenu.Label>Base Plan</DropdownMenu.Label>
      {#each planTiers as tier}
        {#if tier.value !== user.basePlan}
          {@const planForm = setBasePlan.for(tier.value)}
          <form
            {...planForm.enhance(async ({ submit }) => {
              await tcToast(async () => {
                await submit().updates(getUsers());
                toast.success("Plan updated");
              });
            })}
          >
            <input type="hidden" name="id" value={user.id} />
            <input
              {...planForm.fields.basePlan.as("number")}
              type="hidden"
              value={tier.value}
            />
            <DropdownMenu.Item>
              <button type="submit" class="w-full text-left">
                {tier.label}
              </button>
            </DropdownMenu.Item>
          </form>
        {/if}
      {/each}
    </DropdownMenu.Group>
  </DropdownMenu.Content>
</DropdownMenu.Root>
