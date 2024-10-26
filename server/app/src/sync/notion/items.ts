import { Block, ImageBlock, Item, PageProps } from "@contfu/core";
import { PageObjectResponse } from "notion-client-web-fetch/build/src/api-endpoints";
import { MarkOptional } from "ts-essentials";
import { idFromRef, refFromUuid } from "../mappings";
import { getContentBlocks } from "./blocks";
import type { NotionPullOpts } from "./notion";
import { DbQuery, iterateDb, parseImageUrl } from "./notion-helpers";

export async function* iteratePages(
  { credentials, ref, collectionId }: NotionPullOpts,
  params: DbQuery & {}
) {
  for await (const page of iterateDb(credentials, ref, params)) {
    yield parseItem(
      page,
      collectionId,
      (await getContentBlocks(credentials, page.id)) ?? []
    );
  }
}

function parseItem(
  {
    id,
    properties,
    created_time,
    last_edited_time,
    icon,
    cover,
  }: PageObjectResponse,
  collection: number,
  content?: Block[]
): Item {
  const createdAt = new Date(created_time).getTime();
  const props = parseProps(properties);
  const ref = refFromUuid(id);
  const item: Item = {
    id: idFromRef(ref),
    collection,
    createdAt,
    changedAt: new Date(last_edited_time).getTime(),
    props: {
      ...(icon && icon.type !== "emoji"
        ? { icon: ["i", parseImageUrl(icon), "Icon", []] as ImageBlock }
        : {}),
      ...(cover
        ? { cover: ["i", parseImageUrl(cover), "Cover", []] as ImageBlock }
        : {}),
      ...props,
      ...content,
    },
  };
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
  value: MarkOptional<PageObjectResponse["properties"][string], "id">
):
  | number
  | string
  | boolean
  | number[]
  | string[]
  | Buffer[]
  | null
  | undefined {
  switch (value.type) {
    case "rich_text":
      return value.rich_text.length > 0
        ? value.rich_text.map((t) => t.plain_text).join(" ")
        : null;
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
      return value.relation.map((r) =>
        idFromRef(refFromUuid(r.id)).toString("base64url")
      );
    case "created_time":
      return new Date(value.created_time).getTime();
    case "last_edited_time":
      return new Date(value.last_edited_time).getTime();
    case "status":
      return value.status?.name;
    case "rollup":
      return value.rollup.type === "number" || value.rollup.type === "date"
        ? parseValue(value.rollup)
        : (value.rollup.array.map((x) => parseValue(x)) as number[] | string[]);
    case "checkbox":
      return value.checkbox;
    case "url":
      return value.url;
    case "formula":
      return parseValue(
        value.formula as PageObjectResponse["properties"]["formula"]
      );
    case "files":
      return value.files.filter((f) => f.type).map((f) => parseImageUrl(f)!);
    case "people":
      return value.people.map((p) => p.id);
    case "title":
      return value.title.map((x) => x.plain_text).join(" ");
    case "created_by":
    case "last_edited_by":
    case "button":
      return null;
  }
}
