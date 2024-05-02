import {
  Block,
  CustomBlock,
  Heading1Block,
  Heading2Block,
  Heading3Block,
  ImageBlock,
  ParagraphBlock,
  QuoteBlock,
  Text,
  isC,
  isCustom,
  isOl,
  isQuote,
  isUl,
  toPlainText,
} from "@contfu/client";
import { isFullBlock, iteratePaginatedAPI } from "@notionhq/client";
import type {
  BlockObjectResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { notion, parseImageUrl } from "./notion";

const MY_ORIGIN = "https://js2brain.com";

export async function getContentBlocks(key: string, id: string) {
  const list = [] as Block[];
  const map = {} as Record<string, Block>;
  let prev: Block | null = null;
  let ctx: CustomBlock | null = null;
  await iterateBlockChildren(key, id, async (res) => {
    const b = parseBlock(res, prev, ctx);
    if (b === ctx) {
      ctx = null;
      return;
    }
    if (!b) return;
    if (Array.isArray(b)) {
      if (isCustom(b)) list.push((ctx = b));
      else if (ctx) ctx.push((prev = b));
      else list.push((prev = b));
      if (isQuote(b) && res.has_children) {
        const { contentList } = await getContentBlocks(key, res.id);
        b.push(
          ...(contentList as ParagraphBlock[]).map(([, ...texts]) => texts)
        );
      }
      return;
    }
    Object.assign(map, b);
  });
  return { contentList: list, content: map };
}

async function iterateBlockChildren(
  key: string,
  id: string,
  cb: (page: BlockObjectResponse) => void | Promise<void>
): Promise<void> {
  for await (const result of iteratePaginatedAPI(notion.blocks.children.list, {
    auth: key,
    block_id: id,
  })) {
    if (isFullBlock(result)) await cb(result);
  }
}

export function parseBlock(
  block: BlockObjectResponse,
  prev?: Block | null,
  ctx?: CustomBlock | null
): Record<string, Block> | Block | null {
  switch (block.type) {
    case "paragraph": {
      const texts = extractRichTextContent(block.paragraph.rich_text);
      if (isC(texts[0])) {
        if (texts[0][1].startsWith("[[")) {
          const splitIdx = texts[0][1].indexOf(" ");
          const name = texts[0][1].slice(2, splitIdx);
          const propsJson = texts[0][1].slice(splitIdx + 1);
          const props = propsJson && JSON.parse(propsJson);
          return ["x", name, props] satisfies CustomBlock;
        }
        if (texts[0][1] === "]]") {
          return ctx ?? null;
        }
      }
      const [[name], t] = extractMeta(texts);
      if (t.length === 0) return null;
      const b = ["p", ...t] satisfies ParagraphBlock;
      if (name) return { [name]: b };
      return b;
    }
    case "quote": {
      const texts = extractRichTextContent(block.quote.rich_text);
      const b = ["q", texts] satisfies QuoteBlock;
      return b;
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
      const [[name], t] = extractMeta(texts);
      if (t.length === 0) return null;
      const b = ["1", ...t] satisfies Heading1Block;
      if (name) return { [name]: b };
      return b;
    }
    case "heading_2": {
      if (block.has_children) return null;
      const texts = extractRichTextContent(block.heading_2.rich_text);
      const [[name], t] = extractMeta(texts);
      if (t.length === 0) return null;
      const b = ["2", ...t] satisfies Heading2Block;
      if (name) return { [name]: b };
      return b;
    }
    case "heading_3": {
      if (block.has_children) return null;
      const texts = extractRichTextContent(block.heading_3.rich_text);
      const [[name], t] = extractMeta(texts);
      if (t.length === 0) return null;
      const b = ["3", ...t] satisfies Heading3Block;
      if (name) return { [name]: b };
      return b;
    }
    case "bulleted_list_item": {
      const texts = extractRichTextContent(block.bulleted_list_item.rich_text);
      if (!isUl(prev)) return ["u", texts];
      prev.push(texts);
      return null;
    }
    case "numbered_list_item": {
      const texts = extractRichTextContent(block.numbered_list_item.rich_text);
      if (!isOl(prev)) return ["o", texts];
      prev.push(texts);
      return null;
    }
    case "image": {
      const caption = extractRichTextContent(block.image.caption);
      const [[name, widthsStr], cap] = extractMeta(caption);
      const widths = widthsStr?.split(",").map(Number) ?? [];
      if (name) caption.shift();
      const image = [
        "i",
        parseImageUrl(block.image),
        toPlainText(cap),
        ...widths,
      ] satisfies ImageBlock;
      return name ? { [name]: image } : image;
    }
  }
  return null;
}

function extractMeta(texts: Text[]): [string[], Text[]] {
  const [head, ...tail] = texts;
  if (isC(head) && head[1].startsWith("|")) {
    return [head[1].slice(1).split("|").filter(Boolean), tail];
  }
  return [[], texts];
}

function extractRichTextContent(items: RichTextItemResponse[]): Text[] {
  return items.map(({ annotations, href, plain_text: text }) => {
    text = text.trim();
    return href
      ? ["a", text, href.replace(MY_ORIGIN, "")]
      : annotations.code
      ? ["c", text]
      : annotations.bold
      ? ["b", text]
      : annotations.italic
      ? ["i", text]
      : text;
  });
}
