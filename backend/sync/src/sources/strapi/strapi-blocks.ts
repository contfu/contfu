import {
  isOl,
  isUl,
  type Block,
  type Bold,
  type Code,
  type CodeBlock,
  type Heading1Block,
  type Heading2Block,
  type Heading3Block,
  type ImageBlock,
  type Inline,
  type Italic,
  type OrderedListBlock,
  type ParagraphBlock,
  type QuoteBlock,
  type UnorderedListBlock,
} from "@contfu/core";
import type { StrapiBlock, StrapiBlockChild, StrapiMedia } from "./strapi";
import { getMediaUrl } from "./strapi-helpers";

/**
 * Convert Strapi blocks (rich text) to internal Block format.
 */
export function convertStrapiBlocks(blocks: StrapiBlock[] | undefined, baseUrl?: string): Block[] {
  if (!blocks || blocks.length === 0) return [];

  const result: Block[] = [];

  for (const block of blocks) {
    const converted = convertBlock(block, baseUrl);
    if (converted) {
      // Merge consecutive list items
      const prev = result.at(-1);
      if (converted[0] === "u" && prev && prev[0] === "u" && isUl(converted) && isUl(prev)) {
        prev.push(converted[1]);
      } else if (converted[0] === "o" && prev && prev[0] === "o" && isOl(converted) && isOl(prev)) {
        prev.push(converted[1]);
      } else {
        result.push(converted);
      }
    }
  }

  return result;
}

/**
 * Convert a single Strapi block to internal Block format.
 */
function convertBlock(block: StrapiBlock, baseUrl?: string): Block | null {
  switch (block.type) {
    case "paragraph": {
      const inlines = extractInlines(block.children);
      if (inlines.length === 0) return null;
      return ["p", inlines] satisfies ParagraphBlock;
    }

    case "heading": {
      const inlines = extractInlines(block.children);
      if (inlines.length === 0) return null;
      const level = block.level ?? 1;
      if (level === 1) return ["1", inlines] satisfies Heading1Block;
      if (level === 2) return ["2", inlines] satisfies Heading2Block;
      return ["3", inlines] satisfies Heading3Block;
    }

    case "list": {
      const items = block.children?.map((child) => extractInlines(child.children)) ?? [];
      if (items.length === 0) return null;
      // Return single item; caller merges consecutive lists
      const firstItem = items[0];
      if (block.format === "ordered") {
        return ["o", firstItem] satisfies OrderedListBlock;
      }
      return ["u", firstItem] satisfies UnorderedListBlock;
    }

    case "quote": {
      const inlines = extractInlines(block.children);
      return ["q", inlines] satisfies QuoteBlock;
    }

    case "code": {
      const text = block.children?.map((child) => child.text ?? "").join("\n") ?? "";
      const lang = typeof block.language === "string" ? block.language : "";
      return ["c", lang, text] satisfies CodeBlock;
    }

    case "image": {
      const media = block.image as StrapiMedia | undefined;
      if (!media?.url) return null;
      const url = getMediaUrl(media.url, baseUrl);
      const alt = media.alternativeText ?? "";
      return ["i", url, alt, []] satisfies ImageBlock;
    }

    default:
      return null;
  }
}

/**
 * Extract inline elements from Strapi block children.
 */
function extractInlines(children: StrapiBlockChild[] | undefined): Inline[] {
  if (!children) return [];

  return children.flatMap((child): Inline[] => {
    if (child.type === "text") {
      const text = child.text?.trim() ?? "";
      if (text === "") return [];

      // Apply formatting
      if (child.code) return [["c", text] as Code];
      if (child.bold) return [["b", text] as Bold];
      if (child.italic) return [["i", text] as Italic];
      return [text];
    }

    if (child.type === "link" && child.url) {
      const linkText = child.children?.map((c) => c.text ?? "").join("") ?? "";
      return [["a", linkText.trim(), child.url]];
    }

    // Recursively handle nested children
    if (child.children) {
      return extractInlines(child.children);
    }

    return [];
  });
}

/**
 * Check if a Strapi field value is a blocks/rich text array.
 */
export function isStrapiBlocks(value: unknown): value is StrapiBlock[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return false;
  const first = value[0];
  return (
    typeof first === "object" && first !== null && "type" in first && typeof first.type === "string"
  );
}
