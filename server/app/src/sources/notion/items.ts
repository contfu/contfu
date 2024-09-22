import {
  Block,
  ImageBlock,
  Item,
  NotionCollectionConfig,
  PageProps,
} from "@contfu/core";
import { PageObjectResponse } from "notion-client-web-fetch/build/src/api-endpoints";
import { idFromUuid } from "../mappings";
import { getContentBlocks } from "./blocks";
import { DbQuery, iterateDb, parseImageUrl } from "./notion";

export async function* iteratePages(
  key: string,
  { dbId, content }: NotionCollectionConfig,
  {
    src,
    collection,
    ...params
  }: DbQuery & {
    src: number;
    collection: number;
  }
) {
  for await (const page of iterateDb(key, dbId, params)) {
    yield parseItem(
      page,
      src,
      collection,
      content != null
        ? { [content]: (await getContentBlocks(key, page.id)) ?? [] }
        : undefined
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
  src: number,
  collection: number,
  content?: Record<string, Block[]>
): Item {
  const createdAt = new Date(created_time).getTime();
  const props = parseProps(properties);
  const item: Item<{
    icon?: ImageBlock;
    cover?: ImageBlock;
  }> = {
    id: idFromUuid(id),
    src,
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
    switch (prop.type) {
      case "rich_text":
        if (prop.rich_text.length > 0)
          props[key] = prop.rich_text.map((t) => t.plain_text).join(" ");
        break;
      case "number":
        if (prop.number != null) props[key] = prop.number;
        break;
      case "date":
        if (prop.date) props[key] = new Date(prop.date.start).getTime();
        break;
      case "select":
        if (prop.select) props[key] = prop.select.name;
        break;
      case "multi_select":
        props[key] = prop.multi_select.map((s) => s.name);
        break;
      case "relation":
        props[key] = prop.relation.map((r) => idFromUuid(r.id));
        break;
      case "rollup":
        // Skip rollups
        break;
      case "checkbox":
        props[key] = prop.checkbox;
        break;
      case "url":
        if (prop.url) props[key] = prop.url;
        break;
      case "formula":
        switch (prop.formula.type) {
          case "string":
            if (prop.formula.string) props[key] = prop.formula.string;

            break;
          case "boolean":
            if (prop.formula.boolean) props[key] = prop.formula.boolean;
            break;
          case "date":
            if (prop.formula.date)
              props[key] = new Date(prop.formula.date.start).getTime();
            break;
          case "number":
            if (prop.formula.number) props[key] = prop.formula.number;
            break;
        }
        break;
      case "files":
        props[key] = prop.files
          .filter((f) => f.type)
          .map((f) => parseImageUrl(f)!);
        break;
      case "people":
        props[key] = prop.people.map((p) => p.id);
        break;
      case "title":
        props[key] = prop.title.map((x) => x.plain_text).join(" ");
        break;
    }
  }
  return props;
}
