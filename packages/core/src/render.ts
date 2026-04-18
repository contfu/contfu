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
  isCustom,
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
  type CustomBlock,
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
  custom?: (block: CustomBlock, ctx: RenderContext) => string;
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
  const ctx: RenderContext = {
    renderBlock: (block) => renderBlock(block, opts),
    renderInline: (inline) => renderInline(inline, opts),
    renderInlines: (inlines) => renderInlines(inlines, opts),
  };
  return ctx;
}

export function renderInline(inline: Inline, opts?: RenderOptions): string {
  if (isString(inline)) return escapeHtml(inline);

  if (isAnchor(inline)) {
    if (opts?.inlines?.a) return opts.inlines.a(inline);
    const [, text, href] = inline;
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

export function renderBlock(block: Block, opts?: RenderOptions): string {
  const ctx = makeContext(opts);

  if (isP(block)) {
    if (opts?.blocks?.p) return opts.blocks.p(block, ctx);
    return `<p>${renderInlines(block[1], opts)}</p>`;
  }
  if (isH1(block)) {
    if (opts?.blocks?.h1) return opts.blocks.h1(block, ctx);
    return `<h1>${renderInlines(block[1], opts)}</h1>`;
  }
  if (isH2(block)) {
    if (opts?.blocks?.h2) return opts.blocks.h2(block, ctx);
    return `<h2>${renderInlines(block[1], opts)}</h2>`;
  }
  if (isH3(block)) {
    if (opts?.blocks?.h3) return opts.blocks.h3(block, ctx);
    return `<h3>${renderInlines(block[1], opts)}</h3>`;
  }
  if (isQuote(block)) {
    if (opts?.blocks?.blockquote) return opts.blocks.blockquote(block, ctx);
    const children = block[1];
    const inner = children
      .map((c) => (isInline(c) ? renderInline(c, opts) : renderBlock(c, opts)))
      .join("");
    return `<blockquote>${inner}</blockquote>`;
  }
  if (isCode(block)) {
    if (opts?.blocks?.pre) return opts.blocks.pre(block, ctx);
    const [, lang, text] = block;
    const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
    return `<pre><code${langAttr}>${escapeHtml(text)}</code></pre>`;
  }
  if (isUl(block)) {
    if (opts?.blocks?.ul) return opts.blocks.ul(block, ctx);
    const items = block.slice(1) as (Inline | Block)[][];
    const lis = items.map((item) => {
      const inner = item
        .map((c) => (isInline(c) ? renderInline(c, opts) : renderBlock(c, opts)))
        .join("");
      return `<li>${inner}</li>`;
    });
    return `<ul>${lis.join("")}</ul>`;
  }
  if (isOl(block)) {
    if (opts?.blocks?.ol) return opts.blocks.ol(block, ctx);
    const items = block.slice(1) as (Inline | Block)[][];
    const lis = items.map((item) => {
      const inner = item
        .map((c) => (isInline(c) ? renderInline(c, opts) : renderBlock(c, opts)))
        .join("");
      return `<li>${inner}</li>`;
    });
    return `<ol>${lis.join("")}</ol>`;
  }
  if (isTable(block)) {
    if (opts?.blocks?.table) return opts.blocks.table(block, ctx);
    const [, hasHeader, rows] = block;
    const rendered = rows.map((row, ri) => {
      const cells = row.map((cell) => {
        const tag = hasHeader && ri === 0 ? "th" : "td";
        const inner = cell
          .map((c) => (isInline(c) ? renderInline(c, opts) : renderBlock(c, opts)))
          .join("");
        return `<${tag}>${inner}</${tag}>`;
      });
      return `<tr>${cells.join("")}</tr>`;
    });
    return `<table>${rendered.join("")}</table>`;
  }
  if (isImg(block)) {
    if (opts?.blocks?.img) return opts.blocks.img(block, ctx);
    const [, canonical, alt] = block;
    return `<img src="${escapeHtml(buildFileUrl(canonical, opts?.file, "image"))}" alt="${escapeHtml(alt)}">`;
  }
  if (isCustom(block)) {
    if (opts?.blocks?.custom) return opts.blocks.custom(block, ctx);
    const children = block[3] as Block[];
    return children.map((c) => renderBlock(c, opts)).join("");
  }
  return "";
}

export function renderBlocks(blocks: Block[], opts?: RenderOptions): string {
  return blocks.map((b) => renderBlock(b, opts)).join("");
}
