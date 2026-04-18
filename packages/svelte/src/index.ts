import type { SvelteComponent } from "svelte";
import type {
  ParagraphBlock,
  Heading1Block,
  Heading2Block,
  Heading3Block,
  QuoteBlock,
  CodeBlock,
  UnorderedListBlock,
  OrderedListBlock,
  TableBlock,
  ImageBlock,
  CustomBlock,
} from "@contfu/core";

export type BlockComponents = {
  p?: typeof SvelteComponent<{ block: ParagraphBlock }>;
  h1?: typeof SvelteComponent<{ block: Heading1Block }>;
  h2?: typeof SvelteComponent<{ block: Heading2Block }>;
  h3?: typeof SvelteComponent<{ block: Heading3Block }>;
  blockquote?: typeof SvelteComponent<{ block: QuoteBlock }>;
  pre?: typeof SvelteComponent<{ block: CodeBlock }>;
  ul?: typeof SvelteComponent<{ block: UnorderedListBlock }>;
  ol?: typeof SvelteComponent<{ block: OrderedListBlock }>;
  table?: typeof SvelteComponent<{ block: TableBlock }>;
  img?: typeof SvelteComponent<{ block: ImageBlock }>;
  custom?: typeof SvelteComponent<{ block: CustomBlock }>;
};

export const FILE_URL_CONTEXT_KEY = Symbol("@contfu/file");

export { default as Block } from "./Block.svelte";
export { default as Blocks } from "./Blocks.svelte";
export { default as Inline } from "./Inline.svelte";
