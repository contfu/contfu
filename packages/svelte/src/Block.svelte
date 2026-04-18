<script lang="ts">
  import { getContext, setContext } from "svelte";
  import {
    buildFileUrl,
    isP,
    isH1,
    isH2,
    isH3,
    isQuote,
    isCode,
    isUl,
    isOl,
    isTable,
    isImg,
    isCustom,
    isInline,
    type Block as BlockType,
    type FileUrlOptions,
    type Inline as InlineType,
  } from "@contfu/core";
  import { FILE_URL_CONTEXT_KEY, type BlockComponents } from "./index.js";
  import Inline from "./Inline.svelte";
  // eslint-disable-next-line import/no-self-import
  import Block from "./Block.svelte";

  let {
    block,
    components = {},
    file,
  }: { block: BlockType; components?: BlockComponents; file?: FileUrlOptions } = $props();

  if (file) setContext(FILE_URL_CONTEXT_KEY, file);
  const ctxFile = getContext<FileUrlOptions | undefined>(FILE_URL_CONTEXT_KEY);
  const resolvedFile = file ?? ctxFile;

  function inlineItems(items: (InlineType | BlockType)[][]): (InlineType | BlockType)[][] {
    return items;
  }
</script>

{#if isP(block)}
  {#if components.p}
    <svelte:component this={components.p} {block}>
      {#each block[1] as inline}<Inline {inline} />{/each}
    </svelte:component>
  {:else}
    <p>{#each block[1] as inline}<Inline {inline} />{/each}</p>
  {/if}
{:else if isH1(block)}
  {#if components.h1}
    <svelte:component this={components.h1} {block}>
      {#each block[1] as inline}<Inline {inline} />{/each}
    </svelte:component>
  {:else}
    <h1>{#each block[1] as inline}<Inline {inline} />{/each}</h1>
  {/if}
{:else if isH2(block)}
  {#if components.h2}
    <svelte:component this={components.h2} {block}>
      {#each block[1] as inline}<Inline {inline} />{/each}
    </svelte:component>
  {:else}
    <h2>{#each block[1] as inline}<Inline {inline} />{/each}</h2>
  {/if}
{:else if isH3(block)}
  {#if components.h3}
    <svelte:component this={components.h3} {block}>
      {#each block[1] as inline}<Inline {inline} />{/each}
    </svelte:component>
  {:else}
    <h3>{#each block[1] as inline}<Inline {inline} />{/each}</h3>
  {/if}
{:else if isQuote(block)}
  {#if components.blockquote}
    <svelte:component this={components.blockquote} {block}>
      {#each block[1] as child}
        {#if isInline(child)}<Inline inline={child} />{:else}<Block block={child} {components} />{/if}
      {/each}
    </svelte:component>
  {:else}
    <blockquote>
      {#each block[1] as child}
        {#if isInline(child)}<Inline inline={child} />{:else}<Block block={child} {components} />{/if}
      {/each}
    </blockquote>
  {/if}
{:else if isCode(block)}
  {#if components.pre}
    <svelte:component this={components.pre} {block} />
  {:else}
    <pre><code class={block[1] ? `language-${block[1]}` : undefined}>{block[2]}</code></pre>
  {/if}
{:else if isUl(block)}
  {#if components.ul}
    <svelte:component this={components.ul} {block}>
      {#each inlineItems(block.slice(1) as (Inline | Block)[][]) as item}
        <li>
          {#each item as child}
            {#if isInline(child)}<Inline inline={child} />{:else}<Block block={child} {components} />{/if}
          {/each}
        </li>
      {/each}
    </svelte:component>
  {:else}
    <ul>
      {#each inlineItems(block.slice(1) as (Inline | Block)[][]) as item}
        <li>
          {#each item as child}
            {#if isInline(child)}<Inline inline={child} />{:else}<Block block={child} {components} />{/if}
          {/each}
        </li>
      {/each}
    </ul>
  {/if}
{:else if isOl(block)}
  {#if components.ol}
    <svelte:component this={components.ol} {block}>
      {#each inlineItems(block.slice(1) as (Inline | Block)[][]) as item}
        <li>
          {#each item as child}
            {#if isInline(child)}<Inline inline={child} />{:else}<Block block={child} {components} />{/if}
          {/each}
        </li>
      {/each}
    </svelte:component>
  {:else}
    <ol>
      {#each inlineItems(block.slice(1) as (Inline | Block)[][]) as item}
        <li>
          {#each item as child}
            {#if isInline(child)}<Inline inline={child} />{:else}<Block block={child} {components} />{/if}
          {/each}
        </li>
      {/each}
    </ol>
  {/if}
{:else if isTable(block)}
  {#if components.table}
    <svelte:component this={components.table} {block}>
      {#each block[2] as row, ri}
        <tr>
          {#each row as cell}
            {#if block[1] && ri === 0}<th>{#each cell as c}{#if isInline(c)}<Inline inline={c} />{:else}<Block block={c} {components} />{/if}{/each}</th>
            {:else}<td>{#each cell as c}{#if isInline(c)}<Inline inline={c} />{:else}<Block block={c} {components} />{/if}{/each}</td>
            {/if}
          {/each}
        </tr>
      {/each}
    </svelte:component>
  {:else}
    <table>
      {#each block[2] as row, ri}
        <tr>
          {#each row as cell}
            {#if block[1] && ri === 0}<th>{#each cell as c}{#if isInline(c)}<Inline inline={c} />{:else}<Block block={c} {components} />{/if}{/each}</th>
            {:else}<td>{#each cell as c}{#if isInline(c)}<Inline inline={c} />{:else}<Block block={c} {components} />{/if}{/each}</td>
            {/if}
          {/each}
        </tr>
      {/each}
    </table>
  {/if}
{:else if isImg(block)}
  {#if components.img}
    <svelte:component this={components.img} {block} />
  {:else}
    <img src={buildFileUrl(block[1], resolvedFile, "image")} alt={block[2]} />
  {/if}
{:else if isCustom(block)}
  {#if components.custom}
    <svelte:component this={components.custom} {block}>
      {#each block[3] as child}<Block block={child} {components} />{/each}
    </svelte:component>
  {:else}
    {#each block[3] as child}<Block block={child} {components} />{/each}
  {/if}
{/if}
