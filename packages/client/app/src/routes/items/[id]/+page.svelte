<script lang="ts">
  import { browser } from "$app/environment";
  import SourceTypeIcon from "$lib/components/icons/SourceTypeIcon.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { parseSourceRef } from "$lib/source-ref";
  import type { Inline } from "@contfu/core";
  import { ExternalLink, Link2Off } from "@lucide/svelte";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  let sourceRef = $derived(parseSourceRef(data.item.sourceType, data.item.ref));
  let propsView = $state<"pairs" | "json">("pairs");
  let contentView = $state<"rendered" | "json">("rendered");

  const PROPS_VIEW_KEY = "contfu:item-detail:props-view";
  const CONTENT_VIEW_KEY = "contfu:item-detail:content-view";

  onMount(() => {
    const storedPropsView = localStorage.getItem(PROPS_VIEW_KEY);
    if (storedPropsView === "pairs" || storedPropsView === "json") {
      propsView = storedPropsView;
    }

    const storedContentView = localStorage.getItem(CONTENT_VIEW_KEY);
    if (storedContentView === "rendered" || storedContentView === "json") {
      contentView = storedContentView;
    }
  });

  $effect(() => {
    if (!browser) return;
    localStorage.setItem(PROPS_VIEW_KEY, propsView);
  });

  $effect(() => {
    if (!browser) return;
    localStorage.setItem(CONTENT_VIEW_KEY, contentView);
  });

  function formatPropValue(value: unknown): string {
    if (value === null || value === undefined) return "-";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean")
      return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  function inlineText(inline: Inline): string {
    if (typeof inline === "string") return inline;
    if (
      Array.isArray(inline) &&
      inline.length >= 2 &&
      typeof inline[1] === "string"
    ) {
      return inline[1];
    }
    return "";
  }

  function mixedPartText(part: unknown): string {
    if (typeof part === "string") return part;
    if (Array.isArray(part)) {
      if (part.length >= 2 && typeof part[1] === "string") return part[1];
      return part.map((child) => mixedPartText(child)).join("");
    }
    return "";
  }

  function listItemText(item: unknown): string {
    if (!Array.isArray(item)) return "";
    return item.map((part) => mixedPartText(part)).join("");
  }

  function tableCellText(cell: unknown): string {
    if (!Array.isArray(cell)) return "";
    return cell.map((part) => mixedPartText(part)).join(" ");
  }

</script>

<div class="container mx-auto max-w-4xl space-y-6 p-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold">Item Detail</h1>
    <Button href="/items" variant="ghost" size="sm">Back to items</Button>
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title>{data.item.id}</Card.Title>
      <Card.Description>{data.item.collection}</Card.Description>
    </Card.Header>
    <Card.Content>
      <dl class="grid gap-2 text-sm">
        <div>
          <dt class="text-muted-foreground">Source</dt>
          <dd>
            {#if sourceRef.href}
              <Button
                class="h-auto gap-1 p-0"
                variant="link"
                href={sourceRef.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {sourceRef.label}
                {#if sourceRef.type !== null}
                  <SourceTypeIcon type={sourceRef.type} class="h-3.5 w-3.5" />
                {/if}
                <ExternalLink class="h-3.5 w-3.5" />
              </Button>
            {:else if sourceRef.type !== null}
              <Button
                class="h-auto gap-1 p-0 opacity-60"
                variant="ghost"
                disabled
                title="Source link unavailable"
              >
                {sourceRef.label}
                <SourceTypeIcon type={sourceRef.type} class="h-3.5 w-3.5" />
                <Link2Off class="h-3.5 w-3.5" />
              </Button>
            {:else}
              <Button
                class="h-auto gap-1 p-0 opacity-60"
                variant="ghost"
                disabled
                title="Source link unavailable"
              >
                Unknown
                <Link2Off class="h-3.5 w-3.5" />
              </Button>
            {/if}
          </dd>
        </div>
        <div>
          <dt class="text-muted-foreground">ID</dt>
          <dd class="font-mono text-xs">{data.item.id}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground">Changed At</dt>
          <dd>{data.item.changedAt}</dd>
        </div>
      </dl>
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <div class="flex items-center justify-between gap-2">
        <Card.Title class="text-base">Properties</Card.Title>
        <div class="inline-flex gap-1 rounded-md border p-1">
          <Button
            type="button"
            size="sm"
            variant={propsView === "pairs" ? "secondary" : "ghost"}
            onclick={() => (propsView = "pairs")}
          >
            Key-Value
          </Button>
          <Button
            type="button"
            size="sm"
            variant={propsView === "json" ? "secondary" : "ghost"}
            onclick={() => (propsView = "json")}
          >
            JSON
          </Button>
        </div>
      </div>
    </Card.Header>
    <Card.Content>
      {#if propsView === "pairs"}
        {#if Object.keys(data.item.props).length === 0}
          <p class="text-sm text-muted-foreground">No properties available</p>
        {:else}
          <dl class="grid gap-2 text-sm">
            {#each Object.entries(data.item.props) as [key, value]}
              <div>
                <dt class="text-muted-foreground">{key}</dt>
                <dd class="wrap-break-words">
                  {formatPropValue(value)}
                </dd>
              </div>
            {/each}
          </dl>
        {/if}
      {:else}
        <pre class="overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(
            data.item.props,
            null,
            2,
          )}</pre>
      {/if}
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <div class="flex items-center justify-between gap-2">
        <Card.Title class="text-base">Content</Card.Title>
        <div class="inline-flex gap-1 rounded-md border p-1">
          <Button
            type="button"
            size="sm"
            variant={contentView === "rendered" ? "secondary" : "ghost"}
            onclick={() => (contentView = "rendered")}
          >
            Rendered
          </Button>
          <Button
            type="button"
            size="sm"
            variant={contentView === "json" ? "secondary" : "ghost"}
            onclick={() => (contentView = "json")}
          >
            JSON
          </Button>
        </div>
      </div>
    </Card.Header>
    <Card.Content>
      {#if data.item.content && data.item.content.length > 0}
        {#if contentView === "json"}
          <pre
            class="overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(
              data.item.content,
              null,
              2,
            )}</pre>
        {:else}
          <div class="space-y-3 text-sm">
            {#each data.item.content as block}
              {#if block[0] === "1"}
                <h2 class="text-xl font-semibold">
                  {block[1].map(inlineText).join("")}
                </h2>
              {:else if block[0] === "2"}
                <h3 class="text-lg font-semibold">
                  {block[1].map(inlineText).join("")}
                </h3>
              {:else if block[0] === "3"}
                <h4 class="text-base font-semibold">
                  {block[1].map(inlineText).join("")}
                </h4>
              {:else if block[0] === "p"}
                <p>{block[1].map(inlineText).join("")}</p>
              {:else if block[0] === "q"}
                <blockquote class="border-l-2 pl-3 text-muted-foreground">
                  {#each block[1] as part}
                    {#if typeof part === "string"}
                      <span>{part}</span>
                    {:else if Array.isArray(part)}
                      {#if part[0] === "a"}
                        <a
                          href={part[2]}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="underline"
                        >
                          {part[1]}
                        </a>
                      {:else if part[0] === "c" && part.length === 2}
                        <code class="rounded bg-muted px-1 py-0.5 text-xs"
                          >{part[1]}</code
                        >
                      {:else if (part[0] === "b" || part[0] === "i") && part.length === 2}
                        <span>{part[1]}</span>
                      {/if}
                    {/if}
                  {/each}
                </blockquote>
              {:else if block[0] === "c"}
                <pre
                  class="overflow-auto rounded bg-muted p-3 text-xs">{block[2]}</pre>
              {:else if block[0] === "i"}
                <div class="space-y-1">
                  <img
                    src={`/media/${block[1]}.avif`}
                    alt={block[2]}
                    class="max-h-80 rounded border object-contain"
                    loading="lazy"
                  />
                  {#if block[2]}
                    <p class="text-xs text-muted-foreground">{block[2]}</p>
                  {/if}
                </div>
              {:else if block[0] === "u" || block[0] === "o"}
                <div class="pl-4">
                  {#if block[0] === "u"}
                    <ul class="list-disc space-y-1">
                      {#each block.slice(1) as item}
                        <li>{listItemText(item)}</li>
                      {/each}
                    </ul>
                  {:else}
                    <ol class="list-decimal space-y-1">
                      {#each block.slice(1) as item}
                        <li>{listItemText(item)}</li>
                      {/each}
                    </ol>
                  {/if}
                </div>
              {:else if block[0] === "t"}
                <div class="overflow-auto rounded border">
                  <table class="w-full text-sm">
                    <tbody>
                      {#each block[2] as row, rowIdx}
                        <tr class="border-b last:border-b-0">
                          {#each row as cell}
                            <td class="p-2 align-top">
                              {tableCellText(cell)}
                            </td>
                          {/each}
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {:else}
                <pre
                  class="overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(
                    block,
                    null,
                    2,
                  )}</pre>
              {/if}
            {/each}
          </div>
        {/if}
      {:else}
        <p class="text-sm text-muted-foreground">No content available</p>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
