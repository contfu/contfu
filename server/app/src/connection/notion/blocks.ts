import {
  Block,
  Heading1Block,
  Heading2Block,
  Heading3Block,
  ImageBlock,
  ParagraphBlock,
  QuoteBlock,
  Text,
  isOl,
  isQuote,
  isTable,
  isUl,
  toPlainText,
} from "@contfu/core";
import { isFullBlock, iteratePaginatedAPI } from "notion-client-web-fetch";
import type {
  BlockObjectResponse,
  RichTextItemResponse,
} from "notion-client-web-fetch/build/src/api-endpoints";
import { notion, parseImageUrl } from "./notion";

export async function getContentBlocks(key: string, id: string) {
  const blocks = [] as Block[];
  for await (const res of paginatedChildren(key, id)) {
    let b = parseBlock(res);
    if (!b) continue;
    const prev = blocks.at(-1);
    if ((isUl(b) && isUl(prev)) || (isOl(b) && isOl(prev))) {
      prev.push(b[1]);
      b = prev;
    } else blocks.push(b);
    if (res.has_children) {
      if (isUl(b) || isOl(b)) {
        const c = await getContentBlocks(key, res.id);
        if (c) b.push(c);
      }
      if (isQuote(b) && res.has_children) {
        const c = await getContentBlocks(key, res.id);
        b[1].push(...(c as Block[]));
      }
      if (isTable(b) && res.has_children) {
        for await (const row of paginatedChildren(key, res.id)) {
          if (row.type !== "table_row") continue;
          const cells = row.table_row.cells.map((cell) =>
            extractRichTextContent(cell)
          );
          b[2].push(cells);
        }
      }
    }
  }
  return blocks;
}

async function* paginatedChildren(key: string, id: string) {
  for await (const result of iteratePaginatedAPI(notion.blocks.children.list, {
    auth: key,
    block_id: id,
  })) {
    if (isFullBlock(result)) yield result;
  }
}

export function parseBlock(block: BlockObjectResponse): Block | null {
  switch (block.type) {
    case "paragraph": {
      const texts = extractRichTextContent(block.paragraph.rich_text);
      if (texts.length === 0) return null;
      return ["p", texts] satisfies ParagraphBlock;
    }
    case "quote": {
      const texts = extractRichTextContent(block.quote.rich_text);
      return ["q", texts] satisfies QuoteBlock;
    }
    case "code":
      return [
        "c",
        block.code.language,
        block.code.rich_text[0].plain_text.replace(/\\/g, ""),
      ];
    case "heading_1": {
      if (block.has_children) return null;
      const texts = extractRichTextContent(block.heading_1.rich_text);
      return texts.length === 0 ? null : (["1", texts] satisfies Heading1Block);
    }
    case "heading_2": {
      if (block.has_children) return null;
      const texts = extractRichTextContent(block.heading_2.rich_text);
      return texts.length === 0 ? null : (["2", texts] satisfies Heading2Block);
    }
    case "heading_3": {
      if (block.has_children) return null;
      const texts = extractRichTextContent(block.heading_3.rich_text);
      return texts.length === 0 ? null : (["3", texts] satisfies Heading3Block);
    }
    case "bulleted_list_item": {
      const texts = extractRichTextContent(block.bulleted_list_item.rich_text);
      return ["u", texts];
    }
    case "numbered_list_item": {
      const texts = extractRichTextContent(block.numbered_list_item.rich_text);
      return ["o", texts];
    }
    case "image": {
      const caption = extractRichTextContent(block.image.caption);
      return [
        "i",
        parseImageUrl(block.image),
        toPlainText(caption),
        [],
      ] satisfies ImageBlock;
    }
    case "link_to_page": {
      if (block.link_to_page.type !== "page_id") return null;
      return ["p", ["a", "", block.link_to_page.page_id]];
    }
    case "table": {
      return ["t", block.table.has_column_header, []];
    }
  }
  return null;
}

function extractRichTextContent(items: RichTextItemResponse[]): Text[] {
  return items.map(({ annotations, href, plain_text: text }) => {
    text = text.trim();
    return href
      ? ["a", text, href]
      : annotations.code
      ? ["c", text]
      : annotations.bold
      ? ["b", text]
      : annotations.italic
      ? ["i", text]
      : text;
  });
}
