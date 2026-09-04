import type { Block, Inline } from "@contfu/core";
import { isAnchor } from "@contfu/core";
import { PropertyType, propertyTypeBase, schemaType, type CollectionSchema } from "@contfu/core";
import { UnknownSchemaPropertyError } from "./unknownSchemaPropertyError";

const PLACEHOLDER_BASE = -1;

export type LinkRecord =
  | { kind: "internal"; prop: string | null; from: number; to: number }
  | { kind: "external"; from: number; url: string };

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

function tryDecodeItemId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value !== "string") return null;
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 && String(id) === value ? id : null;
}

function walkInlines(inlines: Inline[], records: LinkRecord[], from: number): Inline[] {
  return inlines.map((inline) => {
    if (!isAnchor(inline)) return inline;
    const href = inline[2] as unknown as string; // wire data arrives as string
    const placeholderIdx = records.length;

    if (isExternalHref(href)) {
      records.push({ kind: "external", from, url: href });
    } else {
      const decoded = tryDecodeItemId(href);
      records.push(
        decoded
          ? { kind: "internal", prop: null, from, to: decoded }
          : { kind: "external", from, url: href },
      );
    }

    return ["a", inline[1], PLACEHOLDER_BASE - placeholderIdx] as unknown as Inline;
  });
}

function walkBlocks(blocks: Block[], records: LinkRecord[], from: number): Block[] {
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
  from: number,
  props: Record<string, unknown> | undefined,
  content: Block[] | null | undefined,
  schema: CollectionSchema | null,
): ExtractedLinks {
  const records: LinkRecord[] = [];
  const newProps = props ? { ...props } : {};

  if (schema && props) {
    // Unknown scalar metadata is retained for forward compatibility, but a
    // numeric item reference is never retained raw: without its schema type it
    // cannot safely be persisted and must trigger the connector's resync path.
    const unknownReferenceProperties = Object.entries(props)
      .filter(([name]) => !(name in schema) && name !== "$deletedAt")
      .filter(([, value]) => {
        if (tryDecodeItemId(value) !== null) return true;
        return Array.isArray(value) && value.some((entry) => tryDecodeItemId(entry) !== null);
      })
      .map(([name]) => name);
    if (unknownReferenceProperties.length > 0)
      throw new UnknownSchemaPropertyError(unknownReferenceProperties);
  }

  if (schema && props) {
    for (const [propName, propValue] of Object.entries(schema)) {
      const propType = propertyTypeBase(schemaType(propValue));
      if (propType === PropertyType.REF) {
        const value = props[propName];
        if (value != null) {
          const itemId = tryDecodeItemId(value);
          if (itemId) {
            const placeholderIdx = records.length;
            records.push({ kind: "internal", prop: propName, from, to: itemId });
            newProps[propName] = PLACEHOLDER_BASE - placeholderIdx;
          }
        }
      } else if (propType === PropertyType.REFS) {
        const value = props[propName];
        if (Array.isArray(value) && value.length > 0) {
          const placeholders: number[] = [];
          for (const item of value) {
            const itemId = tryDecodeItemId(item);
            if (itemId) {
              const placeholderIdx = records.length;
              records.push({ kind: "internal", prop: propName, from, to: itemId });
              placeholders.push(PLACEHOLDER_BASE - placeholderIdx);
            }
          }
          newProps[propName] = placeholders;
        }
      }
    }
  }

  let newContent = content;
  if (content && content.length > 0) {
    newContent = walkBlocks(content, records, from);
  }

  return { records, props: newProps, content: newContent };
}

export function replacePlaceholders(
  props: Record<string, unknown>,
  content: Block[] | null | undefined,
  schema: CollectionSchema | null,
  linkIds: number[],
): { props: Record<string, unknown>; content: Block[] | null | undefined } {
  const newProps = { ...props };

  if (schema) {
    for (const [propName, propValue] of Object.entries(schema)) {
      const propType = propertyTypeBase(schemaType(propValue));
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
