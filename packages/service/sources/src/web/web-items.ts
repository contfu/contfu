import type { Item, PageProps } from "@contfu/core";
import { parse, type HTMLElement } from "node-html-parser";
import { genUid } from "../util/ids";
import { convertHtmlToBlocks, convertMarkdownToBlocks } from "./web-blocks";
import {
  extractSlugFromUrl,
  getContentProcessor,
  parseRefUrls,
  resolveUrl,
  webFetch,
  type WebRequestOptions,
} from "./web-helpers";
import type { WebFetchOpts } from "./web";

/**
 * Iterate through web URLs and convert them to Items.
 */
export async function* iterateItems(opts: WebFetchOpts): AsyncGenerator<Item> {
  const urls = parseRefUrls(opts.ref);
  if (urls.length === 0) {
    return;
  }

  const requestOptions: WebRequestOptions = {
    baseUrl: opts.url,
    authType: opts.authType,
    credentials: opts.credentials,
  };

  for (const url of urls) {
    const item = await fetchAndParseUrl(url, opts.collection, requestOptions, opts.since);
    if (item) {
      yield item;
    }
  }
}

/**
 * Fetch a URL and parse it into an Item.
 * Returns null if the item should be skipped (e.g., filtered by since timestamp).
 */
async function fetchAndParseUrl(
  url: string,
  collection: number,
  options: WebRequestOptions,
  since?: number,
): Promise<Item | null> {
  try {
    const result = await webFetch(url, options);

    // Parse last-modified timestamp if available
    const lastModified = result.lastModified ? new Date(result.lastModified).getTime() : undefined;

    // Filter by since timestamp if provided
    if (since && lastModified && lastModified <= since) {
      return null;
    }

    const resolvedUrl = resolveUrl(url, options.baseUrl);
    const contentProcessor = getContentProcessor(result.contentType);

    switch (contentProcessor) {
      case "html":
        return parseHtmlItem(result.body, resolvedUrl, collection, lastModified);
      case "markdown":
        return parseMarkdownItem(result.body, resolvedUrl, collection, lastModified);
      case "json":
        return parseJsonItem(result.body, resolvedUrl, collection, lastModified);
      default:
        // Treat unknown content types as plain text/HTML
        return parseHtmlItem(result.body, resolvedUrl, collection, lastModified);
    }
  } catch {
    // Skip items that fail to fetch - don't propagate errors for individual URLs
    return null;
  }
}

/**
 * Parse HTML content into an Item.
 */
function parseHtmlItem(html: string, url: string, collection: number, lastModified?: number): Item {
  const root = parse(html);

  const slug = extractSlugFromUrl(url);
  const title = extractHtmlTitle(root);
  const description = extractHtmlDescription(root);

  // Extract body content
  const bodyHtml = extractBodyContent(root);
  const content = convertHtmlToBlocks(bodyHtml, url);

  const now = Date.now();
  const rawRef = urlToBuffer(url);

  const props: PageProps = {
    slug,
  };

  if (title) {
    props["title"] = title;
  }
  if (description) {
    props["description"] = description;
  }

  props.createdAt = lastModified ?? now;
  const item: Item = {
    id: genUid(rawRef),
    ref: rawRef,
    collection,
    changedAt: lastModified ?? now,
    props,
  };

  if (content && content.length > 0) {
    item.content = content;
  }

  return item;
}

/**
 * Parse Markdown content into an Item.
 */
function parseMarkdownItem(
  markdown: string,
  url: string,
  collection: number,
  lastModified?: number,
): Item {
  const slug = extractSlugFromUrl(url);
  const title = extractMarkdownTitle(markdown);
  const description = extractMarkdownDescription(markdown);
  const content = convertMarkdownToBlocks(markdown, url);

  const now = Date.now();
  const rawRef = urlToBuffer(url);

  const props: PageProps = {
    slug,
  };

  if (title) {
    props["title"] = title;
  }
  if (description) {
    props["description"] = description;
  }

  props.createdAt = lastModified ?? now;
  const item: Item = {
    id: genUid(rawRef),
    ref: rawRef,
    collection,
    changedAt: lastModified ?? now,
    props,
  };

  if (content && content.length > 0) {
    item.content = content;
  }

  return item;
}

/**
 * Parse JSON content into an Item.
 * JSON responses are stored as raw data in the `data` property.
 */
function parseJsonItem(json: string, url: string, collection: number, lastModified?: number): Item {
  const slug = extractSlugFromUrl(url);
  const now = Date.now();
  const rawRef = urlToBuffer(url);

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    // Store raw string if JSON parsing fails
    data = json;
  }

  const props: PageProps = {
    slug,
    data: JSON.stringify(data),
  };

  props.createdAt = lastModified ?? now;
  const item: Item = {
    id: genUid(rawRef),
    ref: rawRef,
    collection,
    changedAt: lastModified ?? now,
    props,
  };

  return item;
}

/**
 * Extract the title from HTML content.
 * Priority: <title> tag, then first <h1>.
 */
function extractHtmlTitle(root: HTMLElement): string | null {
  // Try <title> tag first
  const titleEl = root.querySelector("title");
  if (titleEl) {
    const text = titleEl.text?.trim();
    if (text) return text;
  }

  // Fall back to first <h1>
  const h1El = root.querySelector("h1");
  if (h1El) {
    const text = h1El.text?.trim();
    if (text) return text;
  }

  return null;
}

/**
 * Extract the description from HTML meta tag.
 */
function extractHtmlDescription(root: HTMLElement): string | null {
  const metaDesc = root.querySelector('meta[name="description"]');
  if (metaDesc) {
    const content = metaDesc.getAttribute("content")?.trim();
    if (content) return content;
  }

  // Try og:description as fallback
  const ogDesc = root.querySelector('meta[property="og:description"]');
  if (ogDesc) {
    const content = ogDesc.getAttribute("content")?.trim();
    if (content) return content;
  }

  return null;
}

/**
 * Extract the main body content from HTML.
 * Prioritizes: <article>, <main>, <body>, or falls back to full content.
 */
function extractBodyContent(root: HTMLElement): string {
  // Try semantic content containers first
  const article = root.querySelector("article");
  if (article) return article.innerHTML;

  const main = root.querySelector("main");
  if (main) return main.innerHTML;

  const body = root.querySelector("body");
  if (body) return body.innerHTML;

  // Fall back to the entire content
  return root.innerHTML;
}

/**
 * Extract the title from Markdown content.
 * Uses the first heading (# or ##).
 */
function extractMarkdownTitle(markdown: string): string | null {
  const lines = markdown.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Match ATX-style headings (# Heading)
    const match = trimmed.match(/^#{1,2}\s+(.+)$/);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extract the description from Markdown content.
 * Uses the first paragraph after the title.
 */
function extractMarkdownDescription(markdown: string): string | null {
  const lines = markdown.split("\n");
  let foundHeading = false;
  let paragraphLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip front matter
    if (trimmed === "---" && paragraphLines.length === 0) {
      continue;
    }

    // Skip headings but mark that we found one
    if (trimmed.match(/^#{1,6}\s+/)) {
      foundHeading = true;
      continue;
    }

    // Skip empty lines before content
    if (!trimmed && paragraphLines.length === 0) {
      continue;
    }

    // Collect paragraph text
    if (
      trimmed &&
      !trimmed.startsWith("```") &&
      !trimmed.startsWith("-") &&
      !trimmed.startsWith("*")
    ) {
      if (foundHeading || paragraphLines.length > 0) {
        paragraphLines.push(trimmed);
      }
    } else if (paragraphLines.length > 0) {
      // End of paragraph
      break;
    }
  }

  const description = paragraphLines.join(" ").trim();
  return description || null;
}

/**
 * Convert a URL to a Buffer for use as ref.
 */
function urlToBuffer(url: string): Buffer {
  return Buffer.from(url, "utf8");
}

/**
 * Fetched web page data for parsing.
 */
export interface WebPageData {
  url: string;
  body: string;
  contentType: string;
  lastModified?: number;
}

/**
 * Parse a web page into an Item (for testing/direct usage).
 */
export function parseWebPage(data: WebPageData, collection: number): Item {
  const contentProcessor = getContentProcessor(data.contentType);

  switch (contentProcessor) {
    case "html":
      return parseHtmlItem(data.body, data.url, collection, data.lastModified);
    case "markdown":
      return parseMarkdownItem(data.body, data.url, collection, data.lastModified);
    case "json":
      return parseJsonItem(data.body, data.url, collection, data.lastModified);
    default:
      return parseHtmlItem(data.body, data.url, collection, data.lastModified);
  }
}
