import type { Block, Item, PageProps } from "@contfu/core";
import { genUid } from "../util/ids";
import type {
  ContentfulEntry,
  ContentfulFetchOpts,
  ContentfulFieldValue,
  ContentfulLink,
  ContentfulAsset,
  ContentfulEntry as ContentfulEntryType,
} from "./contentful";
import { convertContentfulBlocks, isContentfulRichText } from "./contentful-blocks";
import { iterateEntries } from "./contentful-helpers";

const RESERVED_FIELDS = new Set(["sys", "metadata"]);

function unwrapLocalization(value: ContentfulFieldValue): ContentfulFieldValue {
  if (typeof value === "object" && value !== null && "en-US" in value) {
    return (value as { "en-US": ContentfulFieldValue })["en-US"];
  }
  return value;
}

export async function* iterateItems(
  opts: ContentfulFetchOpts,
  params: Record<string, string> = {},
): AsyncGenerator<Item> {
  for await (const entry of iterateEntries(opts, params)) {
    yield parseItem(entry, opts.collection);
  }
}

function parseItem(entry: ContentfulEntry, collection: number): Item {
  const rawRef = Buffer.from(entry.sys.id, "utf8");
  const changedAt = new Date(entry.sys.updatedAt).getTime();

  const { props, content } = parseFields(entry.fields);

  props.createdAt = new Date(entry.sys.createdAt).getTime();

  const item: Item = {
    id: genUid(rawRef),
    ref: rawRef,
    collection,
    changedAt,
    props,
  };

  if (content && content.length > 0) {
    item.content = content;
  }

  return item;
}

function parseFields(fields: Record<string, ContentfulFieldValue>): {
  props: PageProps;
  content?: Block[];
} {
  const props: PageProps = {};
  let content: Block[] | undefined;

  for (const [key, value] of Object.entries(fields)) {
    if (RESERVED_FIELDS.has(key)) continue;

    const normalizedKey = toCamelCase(key);

    const unwrappedValue = unwrapLocalization(value);
    if (isContentfulRichText(unwrappedValue)) {
      const blocks = convertContentfulBlocks(unwrappedValue);
      if (blocks.length > 0) {
        if (!content) {
          content = blocks;
        } else {
          props[normalizedKey] = ["x", normalizedKey, {}, blocks] as unknown as string;
        }
      }
      continue;
    }

    const parsed = parseFieldValue(value);
    if (parsed != null) {
      props[normalizedKey] = parsed;
    }
  }

  return { props, content };
}

function parseFieldValue(
  value: ContentfulFieldValue,
): string | number | boolean | string[] | number[] | Buffer[] | null {
  if (value == null) return null;

  if (typeof value === "string") return value || null;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;

  if (typeof value === "object" && "en-US" in value) {
    return parseFieldValue((value as { "en-US": ContentfulFieldValue })["en-US"]);
  }

  if (isContentfulLink(value) && value.sys.linkType === "Entry") {
    return Buffer.from(value.sys.id, "utf8").toString("base64url");
  }

  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];

    if (isContentfulLink(first)) {
      if (first.sys.linkType === "Entry") {
        const entries = value as ContentfulLink<ContentfulEntryType>[];
        return entries.map((e) => Buffer.from(e.sys.id, "utf8").toString("base64url"));
      }
    }

    const parsedArray: (string | number | boolean | string[] | number[] | Buffer[])[] = value
      .map((v) => parseFieldValue(v))
      .filter((v): v is string | number | boolean | string[] | number[] | Buffer[] => v != null);
    if (parsedArray.length > 0) {
      return parsedArray[0];
    }
  }

  return null;
}

function isContentfulLink(
  value: unknown,
): value is ContentfulLink<ContentfulEntry | ContentfulAsset> {
  return (
    typeof value === "object" &&
    value !== null &&
    "sys" in value &&
    typeof (value as { sys: unknown }).sys === "object" &&
    (value as { sys: { type: string; linkType: string } }).sys.type === "Link"
  );
}

function toCamelCase(str: string): string {
  return str
    .replace(/[-_]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
}
