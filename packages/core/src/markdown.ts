import { isSafeRichContentUrl } from "./url-policy";
import {
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
  isAnchor,
  isMonospace,
  isBold,
  isItalic,
  isString,
  isInline,
  type Block,
  type Inline,
  type ParagraphBlock,
  type Heading1Block,
  type Heading2Block,
  type Heading3Block,
  type QuoteBlock,
  type CodeBlock,
  type UnorderedListBlock,
  type OrderedListBlock,
  type TableBlock,
  type ImageBlock,
  type Component,
  type Anchor,
  type Code,
  type Bold,
  type Italic,
} from "./blocks";
import { buildFileUrl, type FileUrlOptions } from "./render";

export interface MarkdownRenderContext {
  renderBlock: (block: Block) => string;
  renderInline: (inline: Inline) => string;
  renderInlines: (inlines: Inline[]) => string;
}

export type MarkdownBlockRenderers = {
  p?: (block: ParagraphBlock, ctx: MarkdownRenderContext) => string;
  h1?: (block: Heading1Block, ctx: MarkdownRenderContext) => string;
  h2?: (block: Heading2Block, ctx: MarkdownRenderContext) => string;
  h3?: (block: Heading3Block, ctx: MarkdownRenderContext) => string;
  blockquote?: (block: QuoteBlock, ctx: MarkdownRenderContext) => string;
  pre?: (block: CodeBlock, ctx: MarkdownRenderContext) => string;
  ul?: (block: UnorderedListBlock, ctx: MarkdownRenderContext) => string;
  ol?: (block: OrderedListBlock, ctx: MarkdownRenderContext) => string;
  table?: (block: TableBlock, ctx: MarkdownRenderContext) => string;
  img?: (block: ImageBlock, ctx: MarkdownRenderContext) => string;
  component?: (block: Component, ctx: MarkdownRenderContext) => string;
};

export type MarkdownInlineRenderers = {
  a?: (inline: Anchor) => string;
  code?: (inline: Code) => string;
  strong?: (inline: Bold) => string;
  em?: (inline: Italic) => string;
};

export interface MarkdownOptions {
  blocks?: MarkdownBlockRenderers;
  inlines?: MarkdownInlineRenderers;
  file?: FileUrlOptions;
}

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|])/g, "\\$1");
}

function makeMdContext(opts: MarkdownOptions | undefined): MarkdownRenderContext {
  return {
    renderBlock: (block) => renderBlockMarkdown(block, opts),
    renderInline: (inline) => renderInlineMarkdown(inline, opts),
    renderInlines: (inlines) => renderInlinesMarkdown(inlines, opts),
  };
}

function renderChildrenMarkdown(
  children: (Inline | Block)[],
  opts: MarkdownOptions | undefined,
): string {
  return children
    .map((c) =>
      isInline(c) ? renderInlineMarkdown(c, opts) : renderBlockMarkdown(c, opts).trimEnd(),
    )
    .join("");
}

export function renderInlineMarkdown(inline: Inline, opts?: MarkdownOptions): string {
  if (isString(inline)) return escapeMarkdown(inline);
  if (isAnchor(inline)) {
    if (opts?.inlines?.a) return opts.inlines.a(inline);
    const [, text, href] = inline;
    if (!isSafeRichContentUrl(href)) return escapeMarkdown(text);
    return `[${escapeMarkdown(text)}](${href})`;
  }
  if (isMonospace(inline)) {
    if (opts?.inlines?.code) return opts.inlines.code(inline);
    const [, text] = inline;
    return `\`${text}\``;
  }
  if (isBold(inline)) {
    if (opts?.inlines?.strong) return opts.inlines.strong(inline);
    const [, text] = inline;
    return `**${escapeMarkdown(text)}**`;
  }
  if (isItalic(inline)) {
    if (opts?.inlines?.em) return opts.inlines.em(inline);
    const [, text] = inline;
    return `*${escapeMarkdown(text)}*`;
  }
  return "";
}

export function renderInlinesMarkdown(inlines: Inline[], opts?: MarkdownOptions): string {
  return inlines.map((i) => renderInlineMarkdown(i, opts)).join("");
}

/**
 * One entry per block kind: the type guard that claims a block, the
 * `opts.blocks` key that can override it, and the built-in rendering.
 */
interface MarkdownBlockRule {
  match: (block: Block) => boolean;
  override: keyof MarkdownBlockRenderers;
  render: (block: never, opts: MarkdownOptions | undefined) => string;
}

const rule = <T extends Block>(
  match: (block: Block) => block is T,
  override: keyof MarkdownBlockRenderers,
  render: (block: T, opts: MarkdownOptions | undefined) => string,
): MarkdownBlockRule => ({ match, override, render: render as MarkdownBlockRule["render"] });

const heading =
  (level: "#" | "##" | "###") => (block: { 1: Inline[] }, opts: MarkdownOptions | undefined) =>
    `${level} ${renderInlinesMarkdown(block[1], opts)}\n\n`;

const MARKDOWN_BLOCK_RULES: readonly MarkdownBlockRule[] = [
  rule(isP, "p", (block, opts) => `${renderInlinesMarkdown(block[1], opts)}\n\n`),
  rule(isH1, "h1", heading("#")),
  rule(isH2, "h2", heading("##")),
  rule(isH3, "h3", heading("###")),

  rule(
    isQuote,
    "blockquote",
    (block, opts) =>
      renderChildrenMarkdown(block[1], opts)
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n") + "\n\n",
  ),

  rule(isCode, "pre", (block) => {
    const [, lang, text] = block;
    return `\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
  }),

  rule(isUl, "ul", (block, opts) => {
    const items = block.slice(1) as (Inline | Block)[][];
    return items.map((item) => `- ${renderChildrenMarkdown(item, opts)}`).join("\n") + "\n\n";
  }),

  rule(isOl, "ol", (block, opts) => {
    const items = block.slice(1) as (Inline | Block)[][];
    return (
      items.map((item, i) => `${i + 1}. ${renderChildrenMarkdown(item, opts)}`).join("\n") + "\n\n"
    );
  }),

  rule(isTable, "table", (block, opts) => {
    const [, hasHeader, rows] = block;
    if (rows.length === 0) return "";
    const rendered = rows.map(
      (row) => "| " + row.map((cell) => renderChildrenMarkdown(cell, opts)).join(" | ") + " |",
    );
    if (hasHeader) {
      const separator = "| " + Array(rows[0].length).fill("---").join(" | ") + " |";
      rendered.splice(1, 0, separator);
    }
    return rendered.join("\n") + "\n\n";
  }),

  rule(isImg, "img", (block, opts) => {
    const [, canonical, alt] = block;
    return `![${escapeMarkdown(alt)}](${buildFileUrl(canonical, opts?.file, "image")})\n\n`;
  }),

  // A component contributes only its children; the wrapper itself has no
  // markdown representation.
  rule(isComponent, "component", (block, opts) =>
    (block[3] as Block[]).map((child) => renderBlockMarkdown(child, opts)).join(""),
  ),
];

export function renderBlockMarkdown(block: Block, opts?: MarkdownOptions): string {
  for (const { match, override, render } of MARKDOWN_BLOCK_RULES) {
    if (!match(block)) continue;
    const custom = opts?.blocks?.[override];
    return custom
      ? (custom as (b: Block, ctx: MarkdownRenderContext) => string)(block, makeMdContext(opts))
      : render(block as never, opts);
  }
  return "";
}

export function renderBlocksMarkdown(blocks: Block[], opts?: MarkdownOptions): string {
  return blocks
    .map((b) => renderBlockMarkdown(b, opts))
    .join("")
    .trimEnd();
}
