import type { Block, Inline } from "@contfu/core";
import { isAnchor } from "@contfu/core";
import { PropertyType, schemaType, type CollectionSchema } from "@contfu/core";
import type { NewItemLink } from "../../infra/db/schema";

const PLACEHOLDER_BASE = -1;

export type LinkRecord = Omit<NewItemLink, "id">;

export interface ExtractedLinks {
  records: LinkRecord[];
  props: Record<string, unknown>;
  content: Block[] | null | undefined;
}

function isExternalHref(href: string): boolean {
  return (
    href.includes("://") ||
    href.startsWith("/") ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  );
}

function tryDecodeBase64url(s: string): Buffer | null {
  try {
    const buf = Buffer.from(s, "base64url");
    if (buf.length === 0) return null;
    // Round-trip check: re-encode and compare
    if (buf.toString("base64url") !== s) return null;
    return buf;
  } catch {
    return null;
  }
}

function walkInlines(inlines: Inline[], records: LinkRecord[], from: Buffer): Inline[] {
  return inlines.map((inline) => {
    if (!isAnchor(inline)) return inline;
    const href = inline[2] as unknown as string; // wire data arrives as string
    const placeholderIdx = records.length;

    if (isExternalHref(href)) {
      records.push({
        prop: null,
        from,
        to: Buffer.from(href, "utf8"),
        internal: false,
      });
    } else {
      const decoded = tryDecodeBase64url(href);
      if (decoded) {
        records.push({
          prop: null,
          from,
          to: decoded,
          internal: true,
        });
      } else {
        // Treat as external URL
        records.push({
          prop: null,
          from,
          to: Buffer.from(href, "utf8"),
          internal: false,
        });
      }
    }

    return ["a", inline[1], PLACEHOLDER_BASE - placeholderIdx] as unknown as Inline;
  });
}

function walkBlocks(blocks: Block[], records: LinkRecord[], from: Buffer): Block[] {
  return blocks.map((block) => {
    const type = block[0];
    switch (type) {
      case "p":
      case "1":
      case "2":
      case "3": {
        const inlines = walkInlines(block[1] as Inline[], records, from);
        return [type, inlines] as Block;
      }
      case "q": {
        const children = (block[1] as (Inline | Block)[]).map((child) => {
          if (typeof child === "string" || (Array.isArray(child) && isAnchor(child as any))) {
            return walkInlines([child as Inline], records, from)[0];
          }
          return walkBlocks([child as Block], records, from)[0];
        });
        return ["q", children] as Block;
      }
      case "u":
      case "o": {
        const items = (block as any).slice(1) as (Inline | Block)[][];
        const newItems = items.map((item) =>
          item.map((child) => {
            if (typeof child === "string" || (Array.isArray(child) && isAnchor(child as any))) {
              return walkInlines([child as Inline], records, from)[0];
            }
            return walkBlocks([child as Block], records, from)[0];
          }),
        );
        return [type, ...newItems] as Block;
      }
      case "t": {
        const hasHeader = block[1];
        const cells = (block[2] as (Block | Inline)[][][]).map((row) =>
          row.map((cell) =>
            cell.map((child) => {
              if (typeof child === "string" || (Array.isArray(child) && isAnchor(child as any))) {
                return walkInlines([child as Inline], records, from)[0];
              }
              return walkBlocks([child as Block], records, from)[0];
            }),
          ),
        );
        return ["t", hasHeader, cells] as Block;
      }
      case "x": {
        const children = walkBlocks(block[3] as Block[], records, from);
        return ["x", block[1], block[2], children] as Block;
      }
      default:
        return block;
    }
  });
}

export function extractLinks(
  from: Buffer,
  props: Record<string, unknown> | undefined,
  content: Block[] | null | undefined,
  schema: CollectionSchema | null,
): ExtractedLinks {
  const records: LinkRecord[] = [];
  const newProps = props ? { ...props } : {};

  // Extract REF/REFS from props
  if (schema && props) {
    for (const [propName, propValue] of Object.entries(schema)) {
      const propType = schemaType(propValue);
      if (propType === PropertyType.REF) {
        const value = props[propName];
        if (value != null) {
          const buf = toBuffer(value);
          if (buf) {
            const placeholderIdx = records.length;
            records.push({ prop: propName, from, to: buf, internal: true });
            newProps[propName] = PLACEHOLDER_BASE - placeholderIdx;
          }
        }
      } else if (propType === PropertyType.REFS) {
        const value = props[propName];
        if (Array.isArray(value) && value.length > 0) {
          const placeholders: number[] = [];
          for (const item of value) {
            const buf = toBuffer(item);
            if (buf) {
              const placeholderIdx = records.length;
              records.push({ prop: propName, from, to: buf, internal: true });
              placeholders.push(PLACEHOLDER_BASE - placeholderIdx);
            }
          }
          newProps[propName] = placeholders;
        }
      }
    }
  }

  // Extract anchors from content
  let newContent = content;
  if (content && content.length > 0) {
    newContent = walkBlocks(content, records, from);
  }

  return { records, props: newProps, content: newContent };
}

function toBuffer(value: unknown): Buffer | null {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") {
    const decoded = tryDecodeBase64url(value);
    return decoded;
  }
  return null;
}

export function replacePlaceholders(
  props: Record<string, unknown>,
  content: Block[] | null | undefined,
  schema: CollectionSchema | null,
  linkIds: number[],
): { props: Record<string, unknown>; content: Block[] | null | undefined } {
  const newProps = { ...props };

  // Replace prop placeholders with actual link IDs
  if (schema) {
    for (const [propName, propValue] of Object.entries(schema)) {
      const propType = schemaType(propValue);
      if (propType === PropertyType.REF) {
        const value = newProps[propName];
        if (typeof value === "number" && value <= PLACEHOLDER_BASE) {
          const idx = PLACEHOLDER_BASE - value;
          newProps[propName] = linkIds[idx];
        }
      } else if (propType === PropertyType.REFS) {
        const value = newProps[propName];
        if (Array.isArray(value)) {
          newProps[propName] = value.map((v) => {
            if (typeof v === "number" && v <= PLACEHOLDER_BASE) {
              const idx = PLACEHOLDER_BASE - v;
              return linkIds[idx];
            }
            return v;
          });
        }
      }
    }
  }

  // Replace content anchor placeholders with actual link IDs
  let newContent = content;
  if (content && content.length > 0) {
    newContent = replaceContentPlaceholders(content, linkIds);
  }

  return { props: newProps, content: newContent };
}

function replaceContentPlaceholders(blocks: Block[], linkIds: number[]): Block[] {
  return blocks.map((block) => {
    const type = block[0];
    switch (type) {
      case "p":
      case "1":
      case "2":
      case "3": {
        const inlines = replaceInlinePlaceholders(block[1] as Inline[], linkIds);
        return [type, inlines] as Block;
      }
      case "q": {
        const children = (block[1] as (Inline | Block)[]).map((child) => {
          if (typeof child === "string") return child;
          if (Array.isArray(child) && child[0] === "a") {
            return replaceInlinePlaceholders([child as Inline], linkIds)[0];
          }
          return replaceContentPlaceholders([child as Block], linkIds)[0];
        });
        return ["q", children] as Block;
      }
      case "u":
      case "o": {
        const items = (block as any).slice(1) as (Inline | Block)[][];
        const newItems = items.map((item) =>
          item.map((child) => {
            if (typeof child === "string") return child;
            if (Array.isArray(child) && child[0] === "a") {
              return replaceInlinePlaceholders([child as Inline], linkIds)[0];
            }
            return replaceContentPlaceholders([child as Block], linkIds)[0];
          }),
        );
        return [type, ...newItems] as Block;
      }
      case "t": {
        const hasHeader = block[1];
        const cells = (block[2] as (Block | Inline)[][][]).map((row) =>
          row.map((cell) =>
            cell.map((child) => {
              if (typeof child === "string") return child;
              if (Array.isArray(child) && child[0] === "a") {
                return replaceInlinePlaceholders([child as Inline], linkIds)[0];
              }
              return replaceContentPlaceholders([child as Block], linkIds)[0];
            }),
          ),
        );
        return ["t", hasHeader, cells] as Block;
      }
      case "x": {
        const children = replaceContentPlaceholders(block[3] as Block[], linkIds);
        return ["x", block[1], block[2], children] as Block;
      }
      default:
        return block;
    }
  });
}

function replaceInlinePlaceholders(inlines: Inline[], linkIds: number[]): Inline[] {
  return inlines.map((inline) => {
    if (!Array.isArray(inline) || inline[0] !== "a") return inline;
    const href = inline[2];
    if (typeof href === "number" && href <= PLACEHOLDER_BASE) {
      const idx = PLACEHOLDER_BASE - href;
      return ["a", inline[1], linkIds[idx]] as unknown as Inline;
    }
    return inline;
  });
}
