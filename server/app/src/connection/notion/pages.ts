import {
  Block,
  ImageBlock,
  PageData,
  PageProps,
  PageValidationError,
} from "@contfu/core";
import { PageObjectResponse } from "notion-client-web-fetch/build/src/api-endpoints";
import { PageDataValidator } from "../../pages/page-schema";
import { getContentBlocks } from "./blocks";
import { DbQuery, iterateDb, parseImageUrl } from "./notion";

export async function* iteratePages(
  key: string,
  id: string,
  {
    fetchContent = false,
    connection,
    collection,
    ...params
  }: DbQuery & {
    fetchContent?: boolean;
    connection: string;
    collection: string;
  }
) {
  for await (const page of iterateDb(key, id, params)) {
    const content: Block[] = fetchContent
      ? (await getContentBlocks(key, page.id)) ?? []
      : [];
    const parsed = parsePage(page, content, connection, collection);
    yield parsed;
  }
}

function parsePage(
  {
    id,
    properties,
    created_time,
    last_edited_time,
    icon,
    cover,
  }: PageObjectResponse,
  content: Block[],
  connection: string,
  collection: string
): PageData | PageValidationError {
  const createdAt = new Date(created_time).getTime();
  const { props, title, path, description } = parseProps(properties);

  id = id.replace(/-/g, "");
  const page = {
    id,
    title,
    path: path || `/${collection}/${title.replace(/\s+/, "-").toLowerCase()}`,
    description,
    publishedAt: createdAt,
    createdAt,
    changedAt: new Date(last_edited_time).getTime(),
    props: {
      ...props,
      ...(icon && icon.type !== "emoji"
        ? { icon: ["i", parseImageUrl(icon), "Icon", []] as ImageBlock }
        : {}),
      ...(cover
        ? { cover: ["i", parseImageUrl(cover), "Cover", []] as ImageBlock }
        : {}),
    },
    content,
    connection,
    collection,
  };
  const valid = PageDataValidator.Check(page);
  if (valid) return page;
  else {
    const { message, path } = PageDataValidator.Errors(page).First()!;
    return {
      id,
      path,
      message,
    };
  }
}

function parseProps(pageProps: PageObjectResponse["properties"]) {
  const props = {} as PageProps;
  const res: {
    props: PageProps;
    title: string;
    path: string;
    description?: string;
  } = { props, title: "", path: "" };
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
        props[key] = prop.relation.map((r) => r.id.replace(/-/g, ""));
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

    if (typeof props[key] === "string") {
      const str = props[key] as string;
      const lk = key.toLowerCase();
      if (descriptionKeys.has(lk)) {
        res.description = str;
        delete props[key];
      } else if (pathKeys.has(lk)) {
        res.path = str;
        delete props[key];
      } else if (titleKeys.has(lk)) {
        res.title = str;
        delete props[key];
      }
    }
  }
  return res;
}

const descriptionKeys = new Set([
  "description",
  "summary",
  "excerpt",
  "abstract",
]);
const pathKeys = new Set(["path", "url", "path", "href", "link", "slug"]);
const titleKeys = new Set(["title", "name", "heading", "header"]);
