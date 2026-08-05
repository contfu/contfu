<script lang="ts">
  import { getContext, setContext } from "svelte";
  import type { Block as BlockType, FileUrlOptions } from "@contfu/core";
  import { FILE_URL_CONTEXT_KEY, type BlockComponents } from "./index.js";
  import Block from "./Block.svelte";

  let {
    blocks,
    components = {},
    file,
  }: { blocks: BlockType[]; components?: BlockComponents; file?: FileUrlOptions } = $props();

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
</script>

{#each blocks as block}
  <Block {block} {components} />
{/each}
