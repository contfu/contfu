import { Block, Page } from "@contfu/client";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { getContentBlocks } from "./blocks";
import { DbQuery, iterateDb, parseImageUrl } from "./notion";

export async function* iteratePages(
  key: string,
  id: string,
  {
    collection,
    connection,
    fetchContent = false,
    ...params
  }: DbQuery & {
    connection: number;
    collection: string;
    fetchContent?: boolean;
  }
) {
  for await (const page of iterateDb(key, id, params)) {
    let content: Block[] = [];
    if (fetchContent) {
      const { contentList } = await getContentBlocks(key, page.id);
      content = contentList;
    }
    const parsed = parsePage(connection, collection, page, content);
    yield parsed;
  }
}

export type ParsedPage<P extends Page> = {
  ref: string;
  connection: number;
  collection: P["collection"];
  createdAt: number;
  publishedAt: number;
  changedAt: number;
  links: { content: string[] };
  content: Block[];
  props: Props & {
    icon?: string;
    cover?: string;
  };
};

function parsePage<P extends Page>(
  connection: number,
  collection: P["collection"],
  {
    id,
    properties,
    created_time,
    last_edited_time,
    icon,
    cover,
  }: PageObjectResponse,
  content: Block[]
): ParsedPage<P> {
  const createdAt = new Date(created_time).getTime();
  return {
    ref: id.replace(/-/g, ""),
    connection,
    collection,
    createdAt,
    publishedAt: createdAt,
    changedAt: new Date(last_edited_time).getTime(),
    links: { content: [] },
    props: {
      ...parseProps(properties),
      ...(icon && icon.type !== "emoji" ? { icon: parseImageUrl(icon) } : {}),
      ...(cover ? { cover: parseImageUrl(cover) } : {}),
    },
    content,
  };
}

type Props = Record<string, string | number | boolean>;

function parseProps(pageProps: PageObjectResponse["properties"]): Props {
  const parsed = {} as Record<string, any>;
  for (const key in pageProps) {
    const prop = pageProps[key];
    switch (prop.type) {
      case "rich_text":
        if (prop.rich_text.length > 0)
          parsed[key] = prop.rich_text.map((t) => t.plain_text).join(" ");
        break;
      case "number":
        if (prop.number != null) parsed[key] = prop.number;
        break;
      case "date":
        if (prop.date) parsed[key] = new Date(prop.date.start).getTime();
        break;
      case "select":
        if (prop.select) parsed[key] = prop.select.name;
        break;
      case "multi_select":
        parsed[key] = prop.multi_select.map((s) => s.name);
        break;
      case "relation":
        parsed[key] = prop.relation.map((r) => r.id.replace(/-/g, ""));
        break;
      case "rollup":
        // Skip rollups
        break;
      case "checkbox":
        parsed[key] = prop.checkbox;
        break;
      case "url":
        if (prop.url) parsed[key] = prop.url;
        break;
      case "formula":
        switch (prop.formula.type) {
          case "string":
            if (prop.formula.string) parsed[key] = prop.formula.string;

            break;
          case "boolean":
            if (prop.formula.boolean) parsed[key] = prop.formula.boolean;
            break;
          case "date":
            if (prop.formula.date)
              parsed[key] = new Date(prop.formula.date.start).getTime();
            break;
          case "number":
            if (prop.formula.number) parsed[key] = prop.formula.number;
            break;
        }
        break;
      case "files":
        parsed[key] = prop.files
          .filter((f) => f.type)
          .map((f) => parseImageUrl(f));
        break;
      case "people":
        parsed[key] = prop.people.map((p) => p.id);
        break;
      case "title":
        parsed[key] = prop.title[0].plain_text;
    }
  }
  return parsed;
}
