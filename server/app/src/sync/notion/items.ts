import { Block, ImageBlock } from "@contfu/core";
import { PageObjectResponse } from "notion-client-web-fetch/build/src/api-endpoints";
import { ServerPageProps, SyncItem } from "../../data/data";
import { camelCase, idFromRef, refFromUuid } from "../mappings";
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
): SyncItem {
  const createdAt = new Date(created_time).getTime();
  const props = parseProps(properties);
  const ref = refFromUuid(id);
  const item: SyncItem = {
    id: idFromRef(ref),
    ref,
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
  const props = {} as ServerPageProps;
  for (const key in pageProps) {
    const prop = pageProps[key];
    const k = camelCase(key);
    switch (prop.type) {
      case "rich_text":
        if (prop.rich_text.length > 0)
          props[k] = prop.rich_text.map((t) => t.plain_text).join(" ");
        break;
      case "number":
        if (prop.number != null) props[k] = prop.number;
        break;
      case "date":
        if (prop.date) props[k] = new Date(prop.date.start).getTime();
        break;
      case "select":
        if (prop.select) props[k] = prop.select.name;
        break;
      case "multi_select":
        props[k] = prop.multi_select.map((s) => s.name);
        break;
      case "relation":
        props[k] = prop.relation.map((r) => refFromUuid(r.id));
        break;
      case "rollup":
        // Skip rollups
        break;
      case "checkbox":
        props[k] = prop.checkbox;
        break;
      case "url":
        if (prop.url) props[k] = prop.url;
        break;
      case "formula":
        switch (prop.formula.type) {
          case "string":
            if (prop.formula.string) props[k] = prop.formula.string;

            break;
          case "boolean":
            if (prop.formula.boolean) props[k] = prop.formula.boolean;
            break;
          case "date":
            if (prop.formula.date)
              props[k] = new Date(prop.formula.date.start).getTime();
            break;
          case "number":
            if (prop.formula.number) props[k] = prop.formula.number;
            break;
        }
        break;
      case "files":
        props[k] = prop.files
          .filter((f) => f.type)
          .map((f) => parseImageUrl(f)!);
        break;
      case "people":
        props[k] = prop.people.map((p) => p.id);
        break;
      case "title":
        props[k] = prop.title.map((x) => x.plain_text).join(" ");
        break;
    }
  }
  return props;
}
