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
  Component,
} from "@contfu/core";

type ComponentBlockComponent = typeof SvelteComponent<{ block: Component }>;

type BuiltInBlockComponents = {
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
  component?: ComponentBlockComponent;
};

export type BlockComponents = BuiltInBlockComponents & {
  [componentName: string]: BuiltInBlockComponents[keyof BuiltInBlockComponents] | undefined;
};

export const FILE_URL_CONTEXT_KEY = Symbol("@contfu/file");

export { default as Block } from "./Block.svelte";
export { default as Blocks } from "./Blocks.svelte";
export { default as Inline } from "./Inline.svelte";
