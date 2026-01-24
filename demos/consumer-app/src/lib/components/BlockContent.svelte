<script lang="ts">
  import {
    type Block,
    type Inline,
    isH1,
    isH2,
    isH3,
    isP,
    isUl,
    isOl,
    isCode,
    isImg,
    isQuote,
    isTable,
    isString,
    isAnchor,
    isBold,
    isItalic,
    isMonospace,
    isInline,
  } from "@contfu/core";

  interface Props {
    blocks: Block[];
  }

  let { blocks }: Props = $props();

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderInline(inline: Inline): string {
    if (isString(inline)) {
      return escapeHtml(inline);
    }
    if (isAnchor(inline)) {
      return `<a href="${escapeHtml(inline[2])}">${escapeHtml(inline[1])}</a>`;
    }
    if (isBold(inline)) {
      return `<strong>${escapeHtml(inline[1])}</strong>`;
    }
    if (isItalic(inline)) {
      return `<em>${escapeHtml(inline[1])}</em>`;
    }
    if (isMonospace(inline)) {
      return `<code>${escapeHtml(inline[1])}</code>`;
    }
    return "";
  }

  function renderInlines(items: Inline[]): string {
    return items.map((item) => renderInline(item)).join("");
  }

  function renderListItem(item: Inline | Block): string {
    if (isInline(item)) {
      return `<li>${renderInline(item)}</li>`;
    }
    return `<li>${renderBlock(item as Block)}</li>`;
  }

  function renderBlock(block: Block): string {
    if (isH1(block)) {
      return `<h1>${renderInlines(block[1])}</h1>`;
    }
    if (isH2(block)) {
      return `<h2>${renderInlines(block[1])}</h2>`;
    }
    if (isH3(block)) {
      return `<h3>${renderInlines(block[1])}</h3>`;
    }
    if (isP(block)) {
      return `<p>${renderInlines(block[1])}</p>`;
    }
    if (isUl(block)) {
      return `<ul>${block[1].map((item) => renderListItem(item)).join("")}</ul>`;
    }
    if (isOl(block)) {
      return `<ol>${block[1].map((item) => renderListItem(item)).join("")}</ol>`;
    }
    if (isCode(block)) {
      return `<pre><code class="language-${escapeHtml(block[1])}">${escapeHtml(block[2])}</code></pre>`;
    }
    if (isImg(block)) {
      return `<img src="${escapeHtml(block[1])}" alt="${escapeHtml(block[2])}" loading="lazy" />`;
    }
    if (isQuote(block)) {
      const content = block[1]
        .map((item) => {
          if (isInline(item)) {
            return renderInline(item);
          }
          return renderBlock(item as Block);
        })
        .join("");
      return `<blockquote>${content}</blockquote>`;
    }
    if (isTable(block)) {
      const hasHeader = block[1];
      const rows = block[2]
        .map((row, rowIndex) => {
          const cells = row
            .map((cell, cellIndex) => {
              const content = cell
                .map((item) => {
                  if (isInline(item)) {
                    return renderInline(item);
                  }
                  return renderBlock(item as Block);
                })
                .join("");
              return rowIndex === 0 && hasHeader
                ? `<th>${content}</th>`
                : `<td>${content}</td>`;
            })
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("");
      return `<table><tbody>${rows}</tbody></table>`;
    }
    return "";
  }

  const renderedHtml = $derived(blocks.map((block) => renderBlock(block)).join(""));
</script>

{@html renderedHtml}
