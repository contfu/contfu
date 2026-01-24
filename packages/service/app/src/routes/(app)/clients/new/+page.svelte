<script lang="ts">
  import { createConsumer } from "$lib/remote/consumers.remote";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Card from "$lib/components/ui/card";
</script>

<div class="container mx-auto max-w-2xl p-6">
  <div class="mb-6">
    <a href="/clients" class="text-sm text-muted-foreground hover:text-foreground">
      &larr; Back to Clients
    </a>
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title>Add New Client</Card.Title>
      <Card.Description>
        Create a new client to generate an API key for accessing synced content.
      </Card.Description>
    </Card.Header>

    <Card.Content>
      <form method="post" action={createConsumer.action} class="space-y-6">
        <div class="space-y-2">
          <Label for="name">Name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="My Application"
            required
          />
          <p class="text-sm text-muted-foreground">
            A descriptive name for this client (e.g., "Production Website", "Development App").
          </p>
          {#if createConsumer.fields?.name?.issues()?.length}
            <p class="text-sm text-destructive">{createConsumer.fields?.name?.issues()?.[0]?.message}</p>
          {/if}
        </div>

        <div class="flex gap-3">
          <Button type="submit" disabled={!!createConsumer.pending}>
            {createConsumer.pending ? "Creating..." : "Create Client"}
          </Button>
          <Button variant="outline" href="/clients">
            Cancel
          </Button>
        </div>
      </form>
    </Card.Content>
  </Card.Root>
</div>
