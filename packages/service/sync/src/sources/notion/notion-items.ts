import { Block, Item, PageProps } from "@contfu/core";
import { PageObjectResponse } from "notion-client-web-fetch/build/src/api-endpoints";
import { MarkOptional } from "ts-essentials";
import type { NotionFetchOpts } from ".";
import { genUid, uuidToBuffer } from "../../util/ids/ids";
import { getContentBlocks } from "./notion-blocks";
import { DbQuery, getImageUrl, iterateDb } from "./notion-helpers";

export async function* iteratePages(
  { credentials, ref, collection }: NotionFetchOpts,
  params: DbQuery & {},
) {
  for await (const page of iterateDb(credentials, ref, params)) {
    yield parseItem(page, collection, (await getContentBlocks(credentials, page.id)) ?? []);
  }
}

function parseItem(
  { id, properties, created_time, last_edited_time, icon, cover }: PageObjectResponse,
  collection: number,
  content?: Block[],
): Item {
  const createdAt = new Date(created_time).getTime();
  const props = parseProps(properties);
  const ref = uuidToBuffer(id);
  if (icon && icon.type !== "emoji") props.icon = getImageUrl(icon);
  if (cover) props.cover = getImageUrl(cover);
  const item: Item = {
    id: genUid(ref),
    ref,
    collection,
    createdAt,
    changedAt: new Date(last_edited_time).getTime(),
    props,
  };
  if (content && content.length > 0) item.content = content;
  return item;
}

function parseProps(pageProps: PageObjectResponse["properties"]) {
  const props = {} as PageProps;
  for (const key in pageProps) {
    const prop = pageProps[key];
    const value = parseValue(prop);
    if (value != null) props[key] = value;
  }
  return props;
}

function parseValue(
  value: MarkOptional<PageObjectResponse["properties"][string], "id">,
): number | string | boolean | number[] | string[] | Buffer[] | null | undefined {
  switch (value.type) {
    case "title":
      return value.title.length > 0 ? value.title.map((x) => x.plain_text).join(" ") : null;
    case "rich_text":
      return value.rich_text.length > 0 ? value.rich_text.map((t) => t.plain_text).join(" ") : null;
    case "number":
      return value.number;
    case "date":
      return value.date ? new Date(value.date.start).getTime() : null;
    case "select":
      return value.select?.name;
    case "email":
      return value.email;
    case "unique_id":
      return value.unique_id.prefix == null
        ? value.unique_id.number
        : `${value.unique_id.prefix}-${value.unique_id.number}`;
    case "verification":
      return value.verification?.state;
    case "phone_number":
      return value.phone_number;
    case "multi_select":
      return value.multi_select.map((s) => s.name);
    case "relation":
      return value.relation.map(parseRef);
    case "created_time":
      return new Date(value.created_time).getTime();
    case "last_edited_time":
      return new Date(value.last_edited_time).getTime();
    case "status":
      return value.status?.name;
    case "checkbox":
      return value.checkbox;
    case "url":
      return value.url;
    case "files":
      return value.files.filter((f) => f.type).map((f) => getImageUrl(f)!);
    case "people":
      return value.people.map(parseRef);
    case "created_by":
      return parseRef(value.created_by);
    case "last_edited_by":
      return parseRef(value.last_edited_by);
    case "formula":
    case "rollup":
    case "button":
      return null;
  }
}

function parseRef({ id }: { id: string }) {
  return genUid(uuidToBuffer(id)).toString("base64url");
}
