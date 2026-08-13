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

export interface RenderContext {
  renderBlock: (block: Block) => string;
  renderInline: (inline: Inline) => string;
  renderInlines: (inlines: Inline[]) => string;
}

export type BlockRenderers = {
  p?: (block: ParagraphBlock, ctx: RenderContext) => string;
  h1?: (block: Heading1Block, ctx: RenderContext) => string;
  h2?: (block: Heading2Block, ctx: RenderContext) => string;
  h3?: (block: Heading3Block, ctx: RenderContext) => string;
  blockquote?: (block: QuoteBlock, ctx: RenderContext) => string;
  pre?: (block: CodeBlock, ctx: RenderContext) => string;
  ul?: (block: UnorderedListBlock, ctx: RenderContext) => string;
  ol?: (block: OrderedListBlock, ctx: RenderContext) => string;
  table?: (block: TableBlock, ctx: RenderContext) => string;
  img?: (block: ImageBlock, ctx: RenderContext) => string;
  component?: (block: Component, ctx: RenderContext) => string;
};

export type InlineRenderers = {
  a?: (inline: Anchor) => string;
  code?: (inline: Code) => string;
  strong?: (inline: Bold) => string;
  em?: (inline: Italic) => string;
};

export type MediaType = "image" | "video" | "audio";

export interface FileUrlOptions {
  /** Base URL prepended to canonical. Default: "/files". Trailing slash stripped. */
  baseUrl?: string;
  /** Override stored extension for image blocks (e.g. "avif"). */
  imgExt?: string;
  /** Override stored extension for video blocks. */
  videoExt?: string;
  /** Override stored extension for audio blocks (forward-looking). */
  audioExt?: string;
  /** Full escape hatch. Return value used verbatim. `mediaType` is optional — non-media callers omit it. */
  fileUrl?: (params: { id: string; ext: string; mediaType?: MediaType }) => string;
}

export interface RenderOptions {
  blocks?: BlockRenderers;
  inlines?: InlineRenderers;
  file?: FileUrlOptions;
}

export function buildFileUrl(
  canonical: string,
  opts?: FileUrlOptions,
  mediaType?: MediaType,
): string {
  if (/^https?:\/\//i.test(canonical)) return canonical;
  const dot = canonical.lastIndexOf(".");
  if (dot <= 0 || dot === canonical.length - 1) {
    throw new Error(`invalid canonical: expected <id>.<ext>, got "${canonical}"`);
  }
  const id = canonical.slice(0, dot);
  const storedExt = canonical.slice(dot + 1);
  const override =
    mediaType === "image"
      ? opts?.imgExt
      : mediaType === "video"
        ? opts?.videoExt
        : mediaType === "audio"
          ? opts?.audioExt
          : undefined;
  const ext = override ?? storedExt;
  if (opts?.fileUrl) {
    return opts.fileUrl(mediaType ? { id, ext, mediaType } : { id, ext });
  }
  const base = (opts?.baseUrl ?? "/files").replace(/\/$/, "");
  return `${base}/${id}.${ext}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function makeContext(opts: RenderOptions | undefined): RenderContext {
  return {
    renderBlock: (block) => renderBlock(block, opts),
    renderInline: (inline) => renderInline(inline, opts),
    renderInlines: (inlines) => renderInlines(inlines, opts),
  };
}

function renderChildren(children: (Inline | Block)[], opts: RenderOptions | undefined): string {
  return children.map((c) => (isInline(c) ? renderInline(c, opts) : renderBlock(c, opts))).join("");
}

export function renderInline(inline: Inline, opts?: RenderOptions): string {
  if (isString(inline)) return escapeHtml(inline);

  if (isAnchor(inline)) {
    if (opts?.inlines?.a) return opts.inlines.a(inline);
    const [, text, href] = inline;
    if (!isSafeRichContentUrl(href)) return escapeHtml(text);
    return `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`;
  }
  if (isMonospace(inline)) {
    if (opts?.inlines?.code) return opts.inlines.code(inline);
    const [, text] = inline;
    return `<code>${escapeHtml(text)}</code>`;
  }
  if (isBold(inline)) {
    if (opts?.inlines?.strong) return opts.inlines.strong(inline);
    const [, text] = inline;
    return `<strong>${escapeHtml(text)}</strong>`;
  }
  if (isItalic(inline)) {
    if (opts?.inlines?.em) return opts.inlines.em(inline);
    const [, text] = inline;
    return `<em>${escapeHtml(text)}</em>`;
  }
  return "";
}

export function renderInlines(inlines: Inline[], opts?: RenderOptions): string {
  return inlines.map((i) => renderInline(i, opts)).join("");
}

/**
 * One entry per block kind: the type guard that claims a block, the
 * `opts.blocks` key that can override it, and the built-in rendering.
 */
interface HtmlBlockRule {
  match: (block: Block) => boolean;
  override: keyof BlockRenderers;
  render: (block: never, opts: RenderOptions | undefined) => string;
}

const rule = <T extends Block>(
  match: (block: Block) => block is T,
  override: keyof BlockRenderers,
  render: (block: T, opts: RenderOptions | undefined) => string,
): HtmlBlockRule => ({ match, override, render: render as HtmlBlockRule["render"] });

const heading =
  (tag: "h1" | "h2" | "h3") => (block: { 1: Inline[] }, opts: RenderOptions | undefined) =>
    `<${tag}>${renderInlines(block[1], opts)}</${tag}>`;

const listItems = (block: Block, opts: RenderOptions | undefined) =>
  (block.slice(1) as (Inline | Block)[][])
    .map((item) => `<li>${renderChildren(item, opts)}</li>`)
    .join("");

const HTML_BLOCK_RULES: readonly HtmlBlockRule[] = [
  rule(isP, "p", (block, opts) => `<p>${renderInlines(block[1], opts)}</p>`),
  rule(isH1, "h1", heading("h1")),
  rule(isH2, "h2", heading("h2")),
  rule(isH3, "h3", heading("h3")),

  rule(
    isQuote,
    "blockquote",
    (block, opts) => `<blockquote>${renderChildren(block[1], opts)}</blockquote>`,
  ),

  rule(isCode, "pre", (block) => {
    const [, lang, text] = block;
    const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
    return `<pre><code${langAttr}>${escapeHtml(text)}</code></pre>`;
  }),

  rule(isUl, "ul", (block, opts) => `<ul>${listItems(block, opts)}</ul>`),
  rule(isOl, "ol", (block, opts) => `<ol>${listItems(block, opts)}</ol>`),

  rule(isTable, "table", (block, opts) => {
    const [, hasHeader, rows] = block;
    const rendered = rows.map((row, rowIndex) => {
      const tag = hasHeader && rowIndex === 0 ? "th" : "td";
      const cells = row.map((cell) => `<${tag}>${renderChildren(cell, opts)}</${tag}>`);
      return `<tr>${cells.join("")}</tr>`;
    });
    return `<table>${rendered.join("")}</table>`;
  }),

  rule(isImg, "img", (block, opts) => {
    const [, canonical, alt] = block;
    const src = escapeHtml(buildFileUrl(canonical, opts?.file, "image"));
    return `<img src="${src}" alt="${escapeHtml(alt)}">`;
  }),

  // A component contributes only its children; the wrapper itself emits no HTML.
  rule(isComponent, "component", (block, opts) =>
    (block[3] as Block[]).map((child) => renderBlock(child, opts)).join(""),
  ),
];

export function renderBlock(block: Block, opts?: RenderOptions): string {
  for (const { match, override, render } of HTML_BLOCK_RULES) {
    if (!match(block)) continue;
    const custom = opts?.blocks?.[override];
    return custom
      ? (custom as (b: Block, ctx: RenderContext) => string)(block, makeContext(opts))
      : render(block as never, opts);
  }
  return "";
}

export function renderBlocks(blocks: Block[], opts?: RenderOptions): string {
  return blocks.map((b) => renderBlock(b, opts)).join("");
}
