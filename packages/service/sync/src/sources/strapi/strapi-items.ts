import type { Block, Item, PageProps } from "@contfu/core";
import { genUid } from "../../util/ids/ids";
import type {
  StrapiComponent,
  StrapiEntry,
  StrapiFetchOpts,
  StrapiFieldValue,
  StrapiMedia,
  StrapiRelationData,
} from "./strapi";
import { convertStrapiBlocks, isStrapiBlocks } from "./strapi-blocks";
import { getMediaUrl, iterateEntries, StrapiQueryParams } from "./strapi-helpers";

/** Reserved fields that should not be treated as properties. */
const RESERVED_FIELDS = new Set(["id", "documentId", "createdAt", "updatedAt", "publishedAt"]);

/**
 * Iterate through Strapi entries and convert them to Items.
 */
export async function* iterateItems(
  opts: StrapiFetchOpts,
  params: StrapiQueryParams = {},
): AsyncGenerator<Item> {
  for await (const entry of iterateEntries(opts, params)) {
    yield parseItem(entry, opts.collection, opts.url);
  }
}

/**
 * Convert a Strapi entry to an Item.
 */
function parseItem(entry: StrapiEntry, collection: number, baseUrl: string): Item {
  const ref = documentIdToBuffer(entry.documentId);
  const createdAt = new Date(entry.createdAt).getTime();
  const changedAt = new Date(entry.updatedAt).getTime();
  const publishedAt = entry.publishedAt ? new Date(entry.publishedAt).getTime() : undefined;

  const { props, content } = parseFields(entry, baseUrl);

  const item: Item = {
    id: genUid(ref),
    ref,
    collection,
    createdAt,
    changedAt,
    props,
  };

  if (publishedAt) {
    item.publishedAt = publishedAt;
  }

  if (content && content.length > 0) {
    item.content = content;
  }

  return item;
}

/**
 * Parse entry fields into props and content.
 */
function parseFields(entry: StrapiEntry, baseUrl: string): { props: PageProps; content?: Block[] } {
  const props: PageProps = {};
  let content: Block[] | undefined;

  for (const [key, value] of Object.entries(entry)) {
    if (RESERVED_FIELDS.has(key)) continue;
    if (value == null) continue;

    // Check if this field contains blocks/rich text content
    if (isStrapiBlocks(value)) {
      const blocks = convertStrapiBlocks(value, baseUrl);
      if (blocks.length > 0) {
        // Use the first blocks field as content
        if (!content) {
          content = blocks;
        } else {
          // Store additional blocks fields as custom blocks
          props[key] = ["x", key, {}, blocks];
        }
      }
      continue;
    }

    const parsed = parseFieldValue(value, baseUrl);
    if (parsed != null) {
      props[key] = parsed;
    }
  }

  return { props, content };
}

/**
 * Parse a single field value into a property value.
 */
function parseFieldValue(
  value: StrapiFieldValue,
  baseUrl: string,
): string | number | boolean | string[] | number[] | Buffer[] | null {
  // Null
  if (value == null) return null;

  // Primitives
  if (typeof value === "string") return value || null;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;

  // Single media
  if (isStrapiMedia(value)) {
    return getMediaUrl(value.url, baseUrl);
  }

  // Array of media
  if (Array.isArray(value) && value.length > 0 && isStrapiMedia(value[0])) {
    return (value as StrapiMedia[]).map((m) => getMediaUrl(m.url, baseUrl));
  }

  // Single relation
  if (isStrapiRelation(value)) {
    return [documentIdToBuffer(value.documentId)];
  }

  // Array of relations
  if (Array.isArray(value) && value.length > 0 && isStrapiRelation(value[0])) {
    return (value as StrapiRelationData[]).map((r) =>
      genUid(documentIdToBuffer(r.documentId)).toString("base64url"),
    );
  }

  // Component (stored as custom block in props)
  if (isStrapiComponent(value)) {
    return ["x", value.__component, parseComponentProps(value, baseUrl), []] as unknown as string;
  }

  // Array of components
  if (Array.isArray(value) && value.length > 0 && isStrapiComponent(value[0])) {
    return (value as StrapiComponent[]).map((c) =>
      JSON.stringify(["x", c.__component, parseComponentProps(c, baseUrl), []]),
    );
  }

  // Date string
  if (typeof value === "string" && isIsoDateString(value)) {
    return new Date(value).getTime();
  }

  return null;
}

/**
 * Parse component properties, excluding the __component field.
 */
function parseComponentProps(component: StrapiComponent, baseUrl: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(component)) {
    if (key === "id" || key === "__component") continue;
    const parsed = parseFieldValue(val, baseUrl);
    if (parsed != null) {
      result[key] = parsed;
    }
  }
  return result;
}

/**
 * Convert a Strapi documentId to a Buffer.
 */
function documentIdToBuffer(documentId: string): Buffer {
  // documentId is a base62-like string, convert to buffer
  return Buffer.from(documentId, "utf8");
}

/**
 * Check if a value is a Strapi media object.
 */
function isStrapiMedia(value: unknown): value is StrapiMedia {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof (value as StrapiMedia).url === "string"
  );
}

/**
 * Check if a value is a Strapi relation data object.
 */
function isStrapiRelation(value: unknown): value is StrapiRelationData {
  return (
    typeof value === "object" &&
    value !== null &&
    "documentId" in value &&
    typeof (value as StrapiRelationData).documentId === "string" &&
    !("url" in value) // Exclude media objects
  );
}

/**
 * Check if a value is a Strapi component.
 */
function isStrapiComponent(value: unknown): value is StrapiComponent {
  return (
    typeof value === "object" &&
    value !== null &&
    "__component" in value &&
    typeof (value as StrapiComponent).__component === "string"
  );
}

/**
 * Check if a string is an ISO date string.
 */
function isIsoDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(value);
}
