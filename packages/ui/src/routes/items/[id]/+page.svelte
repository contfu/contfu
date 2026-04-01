<script lang="ts">
  import { browser } from "$app/environment";
  import { invalidateAll } from "$app/navigation";
  import ConnectionIcon from "$lib/components/icons/ConnectionIcon.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import * as HoverCard from "$lib/components/ui/hover-card";
  import { subscribeLiveEvent } from "$lib/live/event-source";
  import { parseSourceRef } from "$lib/source-ref";
  import type { Inline } from "@contfu/core";
  import { ExternalLink, Link2Off } from "@lucide/svelte";
  import type { AssetData, ItemData } from "@contfu/contfu";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  let sourceRef = $derived(parseSourceRef(data.item.connectionType, data.item.ref));
  let assetMap = $derived(
    new Map(data.assets.map((a: AssetData) => [a.id, a])),
  );
  let linkedItemMap = $derived(
    new Map(Object.entries(data.linkedItems) as [string, ItemData][]),
  );

  const ASSET_ID_RE = /^[A-Za-z0-9_-]{8,32}$/;

  function linkedItemTitle(item: ItemData): string {
    const v = item.props.title ?? item.props.name;
    if (typeof v === "string") return v;
    return item.id;
  }

  function linkedItemIconUrl(item: ItemData): string | null {
    const v = item.props.icon ?? item.props.image;
    if (typeof v !== "string" || !v) return null;
    if (v.startsWith("http://") || v.startsWith("https://")) return v;
    if (ASSET_ID_RE.test(v)) return `/media/${v}`;
    return null;
  }
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

  onMount(() => {
    return subscribeLiveEvent("data-changed-batch", () => {
      void invalidateAll();
    });
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

<div class="page-shell space-y-6 p-6">
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-semibold tracking-tight">Item Detail</h1>
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
                  <ConnectionIcon type={sourceRef.type} class="h-3.5 w-3.5" />
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
                <ConnectionIcon type={sourceRef.type} class="h-3.5 w-3.5" />
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
                  {#if Array.isArray(value)}
                    <div class="flex flex-col gap-1">
                      {#each value as element}
                        {#if typeof element === "string" && assetMap.has(element)}
                          {@const asset = assetMap.get(element)!}
                          <div class="mb-2">
                            {#if asset.mediaType === "image"}
                              <img
                                src={`/media/${asset.id}.${asset.ext}`}
                                alt={key}
                                class="max-h-60 rounded border object-contain"
                                loading="lazy"
                              />
                            {:else if asset.mediaType === "video"}
                              <!-- svelte-ignore a11y_media_has_caption -->
                              <video
                                src={`/media/${asset.id}.${asset.ext}`}
                                controls
                                class="max-h-60 rounded border"
                              ></video>
                            {:else if asset.mediaType === "audio"}
                              <audio
                                src={`/media/${asset.id}.${asset.ext}`}
                                controls
                              ></audio>
                            {:else}
                              {element}
                            {/if}
                            <p class="text-xs text-muted-foreground">
                              {element}
                            </p>
                          </div>
                        {:else if typeof element === "string" && linkedItemMap.has(element)}
                          {@const linked = linkedItemMap.get(element)!}
                          <HoverCard.Root>
                            <HoverCard.Trigger>
                              <Button
                                variant="link"
                                size="sm"
                                class="h-auto gap-1.5 p-0"
                                href={`/items/${element}`}
                              >
                                {@const iconUrl = linkedItemIconUrl(linked)}
                                {#if iconUrl}
                                  <img
                                    src={iconUrl}
                                    alt=""
                                    class="h-4 w-4 rounded object-cover"
                                    loading="lazy"
                                  />
                                {/if}
                                {linkedItemTitle(linked)}
                              </Button>
                            </HoverCard.Trigger>
                            <HoverCard.Content class="text-xs">
                              {@const iconUrl = linkedItemIconUrl(linked)}
                              {#if iconUrl}
                                <img
                                  src={iconUrl}
                                  alt=""
                                  class="mb-2 h-12 w-12 rounded object-cover"
                                  loading="lazy"
                                />
                              {/if}
                              <p class="font-medium">
                                {linkedItemTitle(linked)}
                              </p>
                              <p class="text-muted-foreground">
                                {linked.collection}
                              </p>
                              <p class="mt-1 font-mono text-muted-foreground">
                                {linked.id}
                              </p>
                            </HoverCard.Content>
                          </HoverCard.Root>
                        {:else}
                          <span>{formatPropValue(element)}</span>
                        {/if}
                      {/each}
                    </div>
                  {:else if typeof value === "string" && assetMap.has(value)}
                    {@const asset = assetMap.get(value)!}
                    <div>
                      {#if asset.mediaType === "image"}
                        <img
                          src={`/media/${asset.id}.${asset.ext}`}
                          alt={key}
                          class="max-h-60 rounded border object-contain"
                          loading="lazy"
                        />
                      {:else if asset.mediaType === "video"}
                        <!-- svelte-ignore a11y_media_has_caption -->
                        <video
                          src={`/media/${asset.id}.${asset.ext}`}
                          controls
                          class="max-h-60 rounded border"
                        ></video>
                      {:else if asset.mediaType === "audio"}
                        <audio src={`/media/${asset.id}.${asset.ext}`} controls
                        ></audio>
                      {:else}
                        {formatPropValue(value)}
                      {/if}
                      <p class="text-xs text-muted-foreground">{value}</p>
                    </div>
                  {:else if typeof value === "string" && linkedItemMap.has(value)}
                    {@const linked = linkedItemMap.get(value)!}
                    <HoverCard.Root>
                      <HoverCard.Trigger>
                        <Button
                          variant="link"
                          size="sm"
                          class="h-auto gap-1.5 p-0"
                          href={`/items/${value}`}
                        >
                          {@const iconUrl = linkedItemIconUrl(linked)}
                          {#if iconUrl}
                            <img
                              src={iconUrl}
                              alt=""
                              class="h-4 w-4 rounded object-cover"
                              loading="lazy"
                            />
                          {/if}
                          {linkedItemTitle(linked)}
                        </Button>
                      </HoverCard.Trigger>
                      <HoverCard.Content class="text-xs">
                        {@const iconUrl = linkedItemIconUrl(linked)}
                        {#if iconUrl}
                          <img
                            src={iconUrl}
                            alt=""
                            class="mb-2 h-12 w-12 rounded object-cover"
                            loading="lazy"
                          />
                        {/if}
                        <p class="font-medium">{linkedItemTitle(linked)}</p>
                        <p class="text-muted-foreground">{linked.collection}</p>
                        <p class="mt-1 font-mono text-muted-foreground">
                          {linked.id}
                        </p>
                      </HoverCard.Content>
                    </HoverCard.Root>
                  {:else}
                    {formatPropValue(value)}
                  {/if}
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
                    src={`/media/${block[1]}.${assetMap.get(block[1])?.ext ?? "avif"}`}
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
