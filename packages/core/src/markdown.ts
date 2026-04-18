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
} from "./blocks";

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|])/g, "\\$1");
}

export function renderInlineMarkdown(inline: Inline): string {
  if (isString(inline)) return escapeMarkdown(inline);
  if (isAnchor(inline)) {
    const [, text, href] = inline;
    return `[${escapeMarkdown(text)}](${href})`;
  }
  if (isMonospace(inline)) {
    const [, text] = inline;
    return `\`${text}\``;
  }
  if (isBold(inline)) {
    const [, text] = inline;
    return `**${escapeMarkdown(text)}**`;
  }
  if (isItalic(inline)) {
    const [, text] = inline;
    return `*${escapeMarkdown(text)}*`;
  }
  return "";
}

export function renderInlinesMarkdown(inlines: Inline[]): string {
  return inlines.map(renderInlineMarkdown).join("");
}

export function renderBlockMarkdown(block: Block): string {
  if (isP(block)) {
    return `${renderInlinesMarkdown(block[1])}\n\n`;
  }
  if (isH1(block)) {
    return `# ${renderInlinesMarkdown(block[1])}\n\n`;
  }
  if (isH2(block)) {
    return `## ${renderInlinesMarkdown(block[1])}\n\n`;
  }
  if (isH3(block)) {
    return `### ${renderInlinesMarkdown(block[1])}\n\n`;
  }
  if (isQuote(block)) {
    const children = block[1];
    const inner = children
      .map((c) => (isInline(c) ? renderInlineMarkdown(c) : renderBlockMarkdown(c).trimEnd()))
      .join("");
    return (
      inner
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n") + "\n\n"
    );
  }
  if (isCode(block)) {
    const [, lang, text] = block;
    return `\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
  }
  if (isUl(block)) {
    const items = block.slice(1) as (Inline | Block)[][];
    const lines = items.map((item) => {
      const inner = item
        .map((c) => (isInline(c) ? renderInlineMarkdown(c) : renderBlockMarkdown(c).trimEnd()))
        .join("");
      return `- ${inner}`;
    });
    return lines.join("\n") + "\n\n";
  }
  if (isOl(block)) {
    const items = block.slice(1) as (Inline | Block)[][];
    const lines = items.map((item, i) => {
      const inner = item
        .map((c) => (isInline(c) ? renderInlineMarkdown(c) : renderBlockMarkdown(c).trimEnd()))
        .join("");
      return `${i + 1}. ${inner}`;
    });
    return lines.join("\n") + "\n\n";
  }
  if (isTable(block)) {
    const [, hasHeader, rows] = block;
    if (rows.length === 0) return "";
    const rendered = rows.map(
      (row) =>
        "| " +
        row
          .map((cell) =>
            cell
              .map((c) =>
                isInline(c) ? renderInlineMarkdown(c) : renderBlockMarkdown(c).trimEnd(),
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
    const [, canonical, alt] = block;
    return `![${escapeMarkdown(alt)}](${canonical})\n\n`;
  }
  if (isCustom(block)) {
    const children = block[3] as Block[];
    return children.map(renderBlockMarkdown).join("");
  }
  return "";
}

export function renderBlocksMarkdown(blocks: Block[]): string {
  return blocks.map(renderBlockMarkdown).join("").trimEnd();
}
