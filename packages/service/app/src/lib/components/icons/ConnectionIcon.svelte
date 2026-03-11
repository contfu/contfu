<script lang="ts">
  import { ConnectionType } from "@contfu/core";
  import { GlobeIcon, NetworkIcon } from "@lucide/svelte";

  interface Props {
    type: ConnectionType;
    class?: string;
  }

  let { type, class: className = "h-6 w-6" }: Props = $props();
</script>

{#if type === ConnectionType.NOTION}
  <svg role="img" viewBox="0 0 24 24" class={className} fill="currentColor">
    <title>Notion</title>
    <path
      d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"
    />
  </svg>
{:else if type === ConnectionType.STRAPI}
  <svg role="img" viewBox="0 0 24 24" class={className} fill="currentColor">
    <title>Strapi</title>
    <path
      d="M8.32 0c-3.922 0-5.882 0-7.1 1.219C0 2.438 0 4.399 0 8.32v7.36c0 3.922 0 5.882 1.219 7.101C2.438 24 4.399 24 8.32 24h7.36c3.922 0 5.882 0 7.101-1.219C24 21.562 24 19.601 24 15.68V8.32c0-3.922 0-5.882-1.219-7.101C21.562 0 19.601 0 15.68 0H8.32zm.41 7.28h7.83a.16.16 0 0 1 .16.16v7.83h-3.87v-3.71a.41.41 0 0 0-.313-.398l-.086-.012h-3.72V7.28zm-.5.25v3.87H4.553a.08.08 0 0 1-.057-.136L8.23 7.529zm.25 4.12h3.87v3.87H8.64a.16.16 0 0 1-.16-.16v-3.71zm4.12 4.12h3.87l-3.734 3.734a.08.08 0 0 1-.136-.057V15.77z"
    />
  </svg>
{:else if type === ConnectionType.CONTENTFUL}
  <svg role="img" viewBox="0 0 24 24" class={className} fill="currentColor">
    <title>Contentful</title>
    <path
      d="M8.16 5.04a3.12 3.12 0 0 1 .96-2.16 3.24 3.24 0 0 1 4.56 0 3.12 3.12 0 0 1 .96 2.16h4.08A4.32 4.32 0 0 1 23.04 9.36v1.44a3.12 3.12 0 0 1 0 6.24v1.68A4.32 4.32 0 0 1 18.72 23.04H5.28A4.32 4.32 0 0 1 .96 18.72v-1.68a3.12 3.12 0 0 1 0-6.24V9.36A4.32 4.32 0 0 1 5.28 5.04zM6.72 10.08a1.92 1.92 0 1 0 0 3.84 1.92 1.92 0 0 0 0-3.84zm10.56 0a1.92 1.92 0 1 0 0 3.84 1.92 1.92 0 0 0 0-3.84z"
    />
  </svg>
{:else if type === ConnectionType.WEB}
  <GlobeIcon class={className} />
{:else if type === ConnectionType.CLIENT}
  <NetworkIcon class={className} />
{:else}
  <svg class={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
  </svg>
{/if}
