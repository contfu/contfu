import {
  isOl,
  isUl,
  type Anchor,
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
import { parse, type HTMLElement, type Node } from "node-html-parser";
import { type Token, type Tokens, lexer } from "marked";

/**
 * Convert HTML string to internal Block format.
 */
export function convertHtmlToBlocks(html: string, baseUrl?: string): Block[] {
  if (!html || html.trim() === "") return [];

  const root = parse(html);
  const result: Block[] = [];

  for (const node of root.childNodes) {
    const converted = convertHtmlNode(node, baseUrl);
    mergeBlocks(result, converted);
  }

  return result;
}

/**
 * Convert Markdown string to internal Block format.
 */
export function convertMarkdownToBlocks(markdown: string, baseUrl?: string): Block[] {
  if (!markdown || markdown.trim() === "") return [];

  const tokens = lexer(markdown);
  const result: Block[] = [];

  for (const token of tokens) {
    const converted = convertMarkdownToken(token, baseUrl);
    mergeBlocks(result, converted);
  }

  return result;
}

/**
 * Merge blocks into result, combining consecutive lists.
 */
function mergeBlocks(result: Block[], blocks: Block[]): void {
  for (const block of blocks) {
    const prev = result.at(-1);
    if (block[0] === "u" && prev && prev[0] === "u" && isUl(block) && isUl(prev)) {
      // Merge unordered list items - each item is an array of (Inline | Block)
      for (let i = 1; i < block.length; i++) {
        (prev as unknown[]).push(block[i]);
      }
    } else if (block[0] === "o" && prev && prev[0] === "o" && isOl(block) && isOl(prev)) {
      // Merge ordered list items - each item is an array of (Inline | Block)
      for (let i = 1; i < block.length; i++) {
        (prev as unknown[]).push(block[i]);
      }
    } else {
      result.push(block);
    }
  }
}

/**
 * Convert a single HTML node to internal Block format.
 */
function convertHtmlNode(node: Node, baseUrl?: string): Block[] {
  // Text nodes
  if (node.nodeType === 3) {
    // Text node
    const text = node.text?.trim() ?? "";
    if (text === "") return [];
    return [["p", [text]] satisfies ParagraphBlock];
  }

  // Element nodes
  if (node.nodeType !== 1) return [];

  const el = node as HTMLElement;
  const tagName = el.tagName?.toLowerCase() ?? "";

  switch (tagName) {
    case "p": {
      const inlines = extractHtmlInlines(el, baseUrl);
      if (inlines.length === 0) return [];
      return [["p", inlines] satisfies ParagraphBlock];
    }

    case "h1": {
      const inlines = extractHtmlInlines(el, baseUrl);
      if (inlines.length === 0) return [];
      return [["1", inlines] satisfies Heading1Block];
    }

    case "h2": {
      const inlines = extractHtmlInlines(el, baseUrl);
      if (inlines.length === 0) return [];
      return [["2", inlines] satisfies Heading2Block];
    }

    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const inlines = extractHtmlInlines(el, baseUrl);
      if (inlines.length === 0) return [];
      return [["3", inlines] satisfies Heading3Block];
    }

    case "ul": {
      const items = el.querySelectorAll(":scope > li");
      if (items.length === 0) return [];
      const listItems: (Inline | Block)[][] = items.map((li) => {
        const inlines = extractHtmlInlines(li, baseUrl);
        return inlines.length > 0 ? inlines : [""];
      });
      return [["u", ...listItems] as UnorderedListBlock];
    }

    case "ol": {
      const items = el.querySelectorAll(":scope > li");
      if (items.length === 0) return [];
      const listItems: (Inline | Block)[][] = items.map((li) => {
        const inlines = extractHtmlInlines(li, baseUrl);
        return inlines.length > 0 ? inlines : [""];
      });
      return [["o", ...listItems] as OrderedListBlock];
    }

    case "blockquote": {
      const children: (Inline | Block)[] = [];
      for (const child of el.childNodes) {
        const childBlocks = convertHtmlNode(child, baseUrl);
        if (childBlocks.length > 0) {
          children.push(...childBlocks);
        } else {
          const inlines = extractHtmlInlines(el, baseUrl);
          children.push(...inlines);
        }
      }
      if (children.length === 0) {
        const inlines = extractHtmlInlines(el, baseUrl);
        return [["q", inlines] satisfies QuoteBlock];
      }
      return [["q", children] satisfies QuoteBlock];
    }

    case "pre": {
      const codeEl = el.querySelector("code");
      const text = (codeEl ?? el).text ?? "";
      const lang = extractCodeLanguage(codeEl ?? el);
      return [["c", lang, text] satisfies CodeBlock];
    }

    case "code": {
      // Standalone code block (not inside pre)
      const parent = el.parentNode as HTMLElement | null;
      if (parent?.tagName?.toLowerCase() === "pre") return [];
      const text = el.text ?? "";
      if (text === "") return [];
      return [["p", [["c", text] as Code]] satisfies ParagraphBlock];
    }

    case "img": {
      const src = el.getAttribute("src") ?? "";
      if (!src) return [];
      const url = resolveImageUrl(src, baseUrl);
      const alt = el.getAttribute("alt") ?? "";
      return [["i", url, alt, []] satisfies ImageBlock];
    }

    case "figure": {
      const img = el.querySelector("img");
      if (!img) return [];
      const src = img.getAttribute("src") ?? "";
      if (!src) return [];
      const url = resolveImageUrl(src, baseUrl);
      const figcaption = el.querySelector("figcaption");
      const alt = figcaption?.text ?? img.getAttribute("alt") ?? "";
      return [["i", url, alt, []] satisfies ImageBlock];
    }

    case "div":
    case "section":
    case "article":
    case "main":
    case "header":
    case "footer":
    case "aside":
    case "nav": {
      // Container elements - process children
      const blocks: Block[] = [];
      for (const child of el.childNodes) {
        const childBlocks = convertHtmlNode(child, baseUrl);
        mergeBlocks(blocks, childBlocks);
      }
      return blocks;
    }

    case "br":
    case "hr":
    case "script":
    case "style":
    case "link":
    case "meta":
      return [];

    default:
      // Unknown elements - try to extract text content
      const inlines = extractHtmlInlines(el, baseUrl);
      if (inlines.length === 0) return [];
      return [["p", inlines] satisfies ParagraphBlock];
  }
}

/**
 * Extract inline elements from an HTML element.
 */
function extractHtmlInlines(el: HTMLElement, baseUrl?: string): Inline[] {
  const inlines: Inline[] = [];

  for (const node of el.childNodes) {
    if (node.nodeType === 3) {
      // Text node
      const text = node.text ?? "";
      if (text.trim() !== "") {
        inlines.push(text);
      }
      continue;
    }

    if (node.nodeType !== 1) continue;

    const childEl = node as HTMLElement;
    const tagName = childEl.tagName?.toLowerCase() ?? "";

    switch (tagName) {
      case "a": {
        const href = childEl.getAttribute("href") ?? "";
        const text = childEl.text?.trim() ?? "";
        if (text) {
          const resolvedHref = href.startsWith("http") ? href : resolveImageUrl(href, baseUrl);
          inlines.push(["a", text, resolvedHref] as Anchor);
        }
        break;
      }

      case "strong":
      case "b": {
        const text = childEl.text?.trim() ?? "";
        if (text) {
          inlines.push(["b", text] as Bold);
        }
        break;
      }

      case "em":
      case "i": {
        const text = childEl.text?.trim() ?? "";
        if (text) {
          inlines.push(["i", text] as Italic);
        }
        break;
      }

      case "code": {
        const text = childEl.text ?? "";
        if (text) {
          inlines.push(["c", text] as Code);
        }
        break;
      }

      case "br":
        break;

      default: {
        // Recursively extract inlines from nested elements
        const nestedInlines = extractHtmlInlines(childEl, baseUrl);
        inlines.push(...nestedInlines);
        break;
      }
    }
  }

  return inlines;
}

/**
 * Extract code language from class attribute.
 */
function extractCodeLanguage(el: HTMLElement): string {
  const className = el.getAttribute("class") ?? "";
  // Match common patterns: language-js, lang-js, highlight-js
  const match = className.match(/(?:language-|lang-|highlight-)(\w+)/);
  return match?.[1] ?? "";
}

/**
 * Resolve image URL against base URL.
 */
function resolveImageUrl(src: string, baseUrl?: string): string {
  if (!baseUrl) return src;
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
    return src;
  }
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return src;
  }
}

/**
 * Convert a single Markdown token to internal Block format.
 */
function convertMarkdownToken(token: Token, baseUrl?: string): Block[] {
  switch (token.type) {
    case "paragraph": {
      const t = token as Tokens.Paragraph;
      const inlines = extractMarkdownInlines(t.tokens ?? [], baseUrl);
      if (inlines.length === 0) return [];
      return [["p", inlines] satisfies ParagraphBlock];
    }

    case "heading": {
      const t = token as Tokens.Heading;
      const inlines = extractMarkdownInlines(t.tokens ?? [], baseUrl);
      if (inlines.length === 0) return [];
      if (t.depth === 1) return [["1", inlines] satisfies Heading1Block];
      if (t.depth === 2) return [["2", inlines] satisfies Heading2Block];
      return [["3", inlines] satisfies Heading3Block];
    }

    case "list": {
      const t = token as Tokens.List;
      const items: (Inline | Block)[][] = t.items.map((item) => {
        // Extract inlines from list item tokens
        const inlines: Inline[] = [];
        for (const itemToken of item.tokens ?? []) {
          if (itemToken.type === "text") {
            const textToken = itemToken as Tokens.Text;
            const textInlines = extractMarkdownInlines(textToken.tokens ?? [], baseUrl);
            if (textInlines.length > 0) {
              inlines.push(...textInlines);
            } else if (textToken.text?.trim()) {
              inlines.push(textToken.text.trim());
            }
          } else if (itemToken.type === "paragraph") {
            const pToken = itemToken as Tokens.Paragraph;
            inlines.push(...extractMarkdownInlines(pToken.tokens ?? [], baseUrl));
          }
        }
        return inlines.length > 0 ? inlines : [""];
      });

      if (items.length === 0) return [];

      if (t.ordered) {
        return [["o", ...items] as OrderedListBlock];
      }
      return [["u", ...items] as UnorderedListBlock];
    }

    case "blockquote": {
      const t = token as Tokens.Blockquote;
      const children: (Inline | Block)[] = [];
      for (const childToken of t.tokens ?? []) {
        const childBlocks = convertMarkdownToken(childToken, baseUrl);
        children.push(...childBlocks);
      }
      if (children.length === 0) {
        return [["q", []] satisfies QuoteBlock];
      }
      return [["q", children] satisfies QuoteBlock];
    }

    case "code": {
      const t = token as Tokens.Code;
      const lang = t.lang ?? "";
      const text = t.text ?? "";
      return [["c", lang, text] satisfies CodeBlock];
    }

    case "image": {
      const t = token as Tokens.Image;
      const url = resolveImageUrl(t.href, baseUrl);
      const alt = t.text ?? t.title ?? "";
      return [["i", url, alt, []] satisfies ImageBlock];
    }

    case "html": {
      // Parse embedded HTML in Markdown
      const t = token as Tokens.HTML;
      return convertHtmlToBlocks(t.raw, baseUrl);
    }

    case "space":
    case "hr":
    case "def":
      return [];

    default:
      return [];
  }
}

/**
 * Extract inline elements from Markdown tokens.
 */
function extractMarkdownInlines(tokens: Token[], baseUrl?: string): Inline[] {
  const inlines: Inline[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "text": {
        const t = token as Tokens.Text;
        const text = t.text ?? "";
        if (text.trim() !== "") {
          // Check for nested tokens
          if (t.tokens && t.tokens.length > 0) {
            inlines.push(...extractMarkdownInlines(t.tokens, baseUrl));
          } else {
            inlines.push(text);
          }
        }
        break;
      }

      case "link": {
        const t = token as Tokens.Link;
        const text = t.text?.trim() ?? "";
        if (text) {
          const href = t.href.startsWith("http") ? t.href : resolveImageUrl(t.href, baseUrl);
          inlines.push(["a", text, href] as Anchor);
        }
        break;
      }

      case "strong": {
        const t = token as Tokens.Strong;
        const text = t.text?.trim() ?? "";
        if (text) {
          inlines.push(["b", text] as Bold);
        }
        break;
      }

      case "em": {
        const t = token as Tokens.Em;
        const text = t.text?.trim() ?? "";
        if (text) {
          inlines.push(["i", text] as Italic);
        }
        break;
      }

      case "codespan": {
        const t = token as Tokens.Codespan;
        const text = t.text ?? "";
        if (text) {
          inlines.push(["c", text] as Code);
        }
        break;
      }

      case "escape": {
        const t = token as Tokens.Escape;
        if (t.text) {
          inlines.push(t.text);
        }
        break;
      }

      case "br":
        break;

      default:
        break;
    }
  }

  return inlines;
}
