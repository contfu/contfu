<script lang="ts">
  import { RenderComponentConfig, RenderSnippetConfig } from "./render-helpers.js";
  import type { Attachment } from "svelte/attachments";

  type Props = {
    // TanStack Table v9 exposes feature-parameterised contexts; rendering is
    // intentionally feature-agnostic here because the same component handles
    // cells and headers from every table in the package.
    content?: string | ((context: any) => any);
    context: any;
    attach?: Attachment;
  };

  let { content, context, attach }: Props = $props();
</script>

{#if typeof content === "string"}
  {content}
{:else if content instanceof Function}
  {@const result = content(context)}
  {#if result instanceof RenderComponentConfig}
    {@const { component: Component, props } = result}
    <Component {...props} {attach} />
  {:else if result instanceof RenderSnippetConfig}
    {@const { snippet, params } = result}
    {@render snippet({ ...params, attach })}
  {:else}
    {result}
  {/if}
{/if}
