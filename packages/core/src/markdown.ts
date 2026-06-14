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

export function renderInlineMarkdown(inline: Inline, opts?: MarkdownOptions): string {
  if (isString(inline)) return escapeMarkdown(inline);
  if (isAnchor(inline)) {
    if (opts?.inlines?.a) return opts.inlines.a(inline);
    const [, text, href] = inline;
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

export function renderBlockMarkdown(block: Block, opts?: MarkdownOptions): string {
  const ctx = makeMdContext(opts);

  if (isP(block)) {
    if (opts?.blocks?.p) return opts.blocks.p(block, ctx);
    return `${renderInlinesMarkdown(block[1], opts)}\n\n`;
  }
  if (isH1(block)) {
    if (opts?.blocks?.h1) return opts.blocks.h1(block, ctx);
    return `# ${renderInlinesMarkdown(block[1], opts)}\n\n`;
  }
  if (isH2(block)) {
    if (opts?.blocks?.h2) return opts.blocks.h2(block, ctx);
    return `## ${renderInlinesMarkdown(block[1], opts)}\n\n`;
  }
  if (isH3(block)) {
    if (opts?.blocks?.h3) return opts.blocks.h3(block, ctx);
    return `### ${renderInlinesMarkdown(block[1], opts)}\n\n`;
  }
  if (isQuote(block)) {
    if (opts?.blocks?.blockquote) return opts.blocks.blockquote(block, ctx);
    const children = block[1];
    const inner = children
      .map((c) =>
        isInline(c) ? renderInlineMarkdown(c, opts) : renderBlockMarkdown(c, opts).trimEnd(),
      )
      .join("");
    return (
      inner
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n") + "\n\n"
    );
  }
  if (isCode(block)) {
    if (opts?.blocks?.pre) return opts.blocks.pre(block, ctx);
    const [, lang, text] = block;
    return `\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
  }
  if (isUl(block)) {
    if (opts?.blocks?.ul) return opts.blocks.ul(block, ctx);
    const items = block.slice(1) as (Inline | Block)[][];
    const lines = items.map((item) => {
      const inner = item
        .map((c) =>
          isInline(c) ? renderInlineMarkdown(c, opts) : renderBlockMarkdown(c, opts).trimEnd(),
        )
        .join("");
      return `- ${inner}`;
    });
    return lines.join("\n") + "\n\n";
  }
  if (isOl(block)) {
    if (opts?.blocks?.ol) return opts.blocks.ol(block, ctx);
    const items = block.slice(1) as (Inline | Block)[][];
    const lines = items.map((item, i) => {
      const inner = item
        .map((c) =>
          isInline(c) ? renderInlineMarkdown(c, opts) : renderBlockMarkdown(c, opts).trimEnd(),
        )
        .join("");
      return `${i + 1}. ${inner}`;
    });
    return lines.join("\n") + "\n\n";
  }
  if (isTable(block)) {
    if (opts?.blocks?.table) return opts.blocks.table(block, ctx);
    const [, hasHeader, rows] = block;
    if (rows.length === 0) return "";
    const rendered = rows.map(
      (row) =>
        "| " +
        row
          .map((cell) =>
            cell
              .map((c) =>
                isInline(c)
                  ? renderInlineMarkdown(c, opts)
                  : renderBlockMarkdown(c, opts).trimEnd(),
              )
              .join(""),
          )
          .join(" | ") +
        " |",
    );
    if (hasHeader && rendered.length > 0) {
      const colCount = rows[0].length;
      const separator = "| " + Array(colCount).fill("---").join(" | ") + " |";
      rendered.splice(1, 0, separator);
    }
    return rendered.join("\n") + "\n\n";
  }
  if (isImg(block)) {
    if (opts?.blocks?.img) return opts.blocks.img(block, ctx);
    const [, canonical, alt] = block;
    const src = buildFileUrl(canonical, opts?.file, "image");
    return `![${escapeMarkdown(alt)}](${src})\n\n`;
  }
  if (isComponent(block)) {
    if (opts?.blocks?.component) return opts.blocks.component(block, ctx);
    const children = block[3] as Block[];
    return children.map((c) => renderBlockMarkdown(c, opts)).join("");
  }
  return "";
}

export function renderBlocksMarkdown(blocks: Block[], opts?: MarkdownOptions): string {
  return blocks
    .map((b) => renderBlockMarkdown(b, opts))
    .join("")
    .trimEnd();
}
