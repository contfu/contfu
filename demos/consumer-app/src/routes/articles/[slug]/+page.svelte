<script lang="ts">
  import type { PageData } from "./$types.js";
  import BlockContent from "$lib/components/BlockContent.svelte";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.article.title} - Contfu Demo</title>
</svelte:head>

<header>
  <a href="/" class="back">&larr; Back to articles</a>
  <h1>{data.article.title}</h1>
  <p class="meta">Updated: {data.article.changedAt.toLocaleDateString()}</p>
</header>

<article>
  <BlockContent blocks={data.article.content} />
</article>
