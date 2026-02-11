import type { Item } from "@contfu/core";
import { isFullPage } from "@notionhq/client";
import { getContentBlocks } from "./notion-blocks";
import { notion } from "./notion-helpers";
import { parseItem } from "./notion-items";

/**
 * Fetches a single Notion page by ID and converts it to an Item.
 * Returns the parsed Item AND the parent database ID so the webhook handler
 * can look up the source collection without a separate API call.
 */
export async function fetchNotionPage(
  auth: string,
  pageId: string,
  collection: number,
): Promise<{ item: Item; parentDatabaseId: string | null } | null> {
  const page = await notion.pages.retrieve({ auth, page_id: pageId });
  if (!isFullPage(page)) return null;

  const parentDatabaseId = page.parent.type === "database_id" ? page.parent.database_id : null;

  const content = await getContentBlocks(auth, page.id);
  const item = parseItem(page, collection, content ?? []);

  return { item, parentDatabaseId };
}
