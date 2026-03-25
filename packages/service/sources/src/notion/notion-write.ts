import { toCamelCase, type CollectionSchema } from "@contfu/svc-core";
import { Client } from "@notionhq/client";

/**
 * Extract the Notion page ID from a Notion ref URL.
 * Ref URLs are formatted as `https://notion.so/{32-char-hex}`.
 * Returns the page ID as a UUID string (with or without dashes), or null if not a Notion URL.
 */
function notionPageIdFromRefUrl(refUrl: string): string | null {
  const match = refUrl.match(/notion\.so\/([0-9a-f]{32})$/i);
  if (!match) return null;
  const hex = match[1];
  // Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Write a Contfu item to a Notion database.
 *
 * - If the item has a Notion ref URL (sourceType 0 = Notion), updates the existing page.
 * - Otherwise, creates a new page in the database.
 *
 * Property names are reverse-mapped by fetching the live Notion database schema
 * and matching camelCase keys back to original Notion property names.
 */
export async function writeItemToNotion(
  token: string,
  databaseId: string,
  schema: CollectionSchema,
  props: Record<string, unknown>,
  refUrl: string | null,
): Promise<void> {
  const client = new Client({ auth: token });

  // Fetch live Notion database to get original property names and types
  const db = await client.databases.retrieve({ database_id: databaseId });
  const notionProps = "properties" in db ? (db.properties as Record<string, { type: string }>) : {};

  // Build reverse map: camelCase → original Notion property name
  const camelToOriginal = new Map<string, string>();
  for (const originalName of Object.keys(notionProps)) {
    camelToOriginal.set(toCamelCase(originalName), originalName);
  }

  const properties = buildNotionProperties(schema, props, notionProps, camelToOriginal);

  const pageId = refUrl ? notionPageIdFromRefUrl(refUrl) : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedProperties = properties as any;
  if (pageId) {
    await client.pages.update({ page_id: pageId, archived: false, properties: typedProperties });
  } else {
    await client.pages.create({ parent: { database_id: databaseId }, properties: typedProperties });
  }
}

function buildNotionProperties(
  schema: CollectionSchema,
  props: Record<string, unknown>,
  notionProps: Record<string, { type: string }>,
  camelToOriginal: Map<string, string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [camelKey] of Object.entries(schema)) {
    const value = props[camelKey];
    if (value === undefined || value === null) continue;

    const originalName = camelToOriginal.get(camelKey);
    if (!originalName) continue;

    const notionProp = notionProps[originalName];
    if (!notionProp) continue;

    const notionValue = propValueToNotion(notionProp.type, value);
    if (notionValue !== null) {
      result[originalName] = notionValue;
    }
  }

  return result;
}

function propValueToNotion(notionType: string, value: unknown): unknown {
  switch (notionType) {
    case "title":
      return { title: [{ text: { content: String(value) } }] };
    case "rich_text":
      return { rich_text: [{ text: { content: String(value) } }] };
    case "number":
      return { number: Number(value) };
    case "checkbox":
      return { checkbox: Boolean(value) };
    case "date":
      return { date: { start: new Date(Number(value)).toISOString().split("T")[0] } };
    case "select":
    case "status":
      return { [notionType]: { name: String(value) } };
    case "multi_select":
      if (Array.isArray(value)) {
        return { multi_select: (value as string[]).map((s) => ({ name: s })) };
      }
      return null;
    case "url":
      return { url: String(value) };
    case "email":
      return { email: String(value) };
    case "phone_number":
      return { phone_number: String(value) };
    default:
      // Skip read-only or unsupported types (formula, rollup, relation, etc.)
      return null;
  }
}
