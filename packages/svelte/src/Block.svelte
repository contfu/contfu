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
    isComponent,
    isInline,
    type Block as BlockType,
    type Component as ComponentBlock,
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

  const inheritedContext = getContext<FileUrlOptions | undefined>(FILE_URL_CONTEXT_KEY);
  const resolvedFile = $derived(file ?? inheritedContext);
  const fileContext: FileUrlOptions = {
    get baseUrl() {
      return resolvedFile?.baseUrl;
    },
    get imgExt() {
      return resolvedFile?.imgExt;
    },
    get videoExt() {
      return resolvedFile?.videoExt;
    },
    get audioExt() {
      return resolvedFile?.audioExt;
    },
    get fileUrl() {
      return resolvedFile?.fileUrl;
    },
  };
  setContext(FILE_URL_CONTEXT_KEY, fileContext);

  type ComponentBlockRenderer = NonNullable<BlockComponents["component"]>;

  function inlineItems(items: (InlineType | BlockType)[][]): (InlineType | BlockType)[][] {
    return items;
  }

  function getComponentBlockRenderer(
    componentBlock: ComponentBlock,
  ): ComponentBlockRenderer | undefined {
    return (components[componentBlock[1]] ?? components.component) as
      | ComponentBlockRenderer
      | undefined;
  }

  let componentRenderer = $derived(
    isComponent(block) ? getComponentBlockRenderer(block as ComponentBlock) : undefined,
  );
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
      {#each inlineItems(block.slice(1) as (InlineType | BlockType)[][]) as item}
        <li>
          {#each item as child}
            {#if isInline(child)}<Inline inline={child} />{:else}<Block block={child} {components} />{/if}
          {/each}
        </li>
      {/each}
    </svelte:component>
  {:else}
    <ul>
      {#each inlineItems(block.slice(1) as (InlineType | BlockType)[][]) as item}
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
      {#each inlineItems(block.slice(1) as (InlineType | BlockType)[][]) as item}
        <li>
          {#each item as child}
            {#if isInline(child)}<Inline inline={child} />{:else}<Block block={child} {components} />{/if}
          {/each}
        </li>
      {/each}
    </svelte:component>
  {:else}
    <ol>
      {#each inlineItems(block.slice(1) as (InlineType | BlockType)[][]) as item}
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
      {#if block[1] && block[2].length > 0}
        <thead>
          {#each block[2].slice(0, 1) as row}
            <tr>
              {#each row as cell}
                <th>{#each cell as c}{#if isInline(c)}<Inline inline={c} />{:else}<Block block={c} {components} />{/if}{/each}</th>
              {/each}
            </tr>
          {/each}
        </thead>
      {/if}
      <tbody>
        {#each block[2].slice(block[1] ? 1 : 0) as row}
          <tr>
            {#each row as cell}
              <td>{#each cell as c}{#if isInline(c)}<Inline inline={c} />{:else}<Block block={c} {components} />{/if}{/each}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </svelte:component>
  {:else}
    <table>
      {#if block[1] && block[2].length > 0}
        <thead>
          {#each block[2].slice(0, 1) as row}
            <tr>
              {#each row as cell}
                <th>{#each cell as c}{#if isInline(c)}<Inline inline={c} />{:else}<Block block={c} {components} />{/if}{/each}</th>
              {/each}
            </tr>
          {/each}
        </thead>
      {/if}
      <tbody>
        {#each block[2].slice(block[1] ? 1 : 0) as row}
          <tr>
            {#each row as cell}
              <td>{#each cell as c}{#if isInline(c)}<Inline inline={c} />{:else}<Block block={c} {components} />{/if}{/each}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
{:else if isImg(block)}
  {#if components.img}
    <svelte:component this={components.img} {block} />
  {:else}
    <img src={buildFileUrl(block[1], resolvedFile, "image")} alt={block[2]} />
  {/if}
{:else if isComponent(block)}
  {#if componentRenderer}
    <svelte:component this={componentRenderer} {block}>
      {#each block[3] as child}<Block block={child} {components} />{/each}
    </svelte:component>
  {:else}
    {#each block[3] as child}<Block block={child} {components} />{/each}
  {/if}
{/if}
