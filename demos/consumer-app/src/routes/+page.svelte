<script lang="ts">
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Contfu Demo - Articles</title>
</svelte:head>

<header>
  <h1>Contfu Demo</h1>
  <p class="subtitle">Content synced from Strapi via Contfu</p>
</header>

<div class="status">
  Server: {data.syncUrl}
  | Stream:
  {#if data.syncStatus.connected}
    Connected
  {:else if data.syncStatus.reason}
    Error
    ({data.syncStatus.reason})
  {:else}
    Connecting
  {/if}
  | Articles: {data.articles.length}
</div>

<main>
  {#if data.articles.length > 0}
    {#each data.articles as article}
      <article class="article-card">
        <h2>
          <a href="/articles/{article.slug}">{article.title}</a>
        </h2>
        <p class="description">{article.description}</p>
        <p class="meta">Updated: {article.changedAt.toLocaleDateString()}</p>
      </article>
    {/each}
  {:else}
    <p class="empty">
      No articles synced yet. Content will appear automatically when available.
    </p>
  {/if}
</main>
