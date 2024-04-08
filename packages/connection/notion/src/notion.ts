import { Client, isFullPage, iteratePaginatedAPI } from "@notionhq/client";
import { QueryDatabaseParameters } from "@notionhq/client/build/src/api-endpoints";

export const notion = new Client({});

export type DbQuery = Partial<
  Omit<QueryDatabaseParameters, "database_id" | "auth">
>;

export async function* iterateDb(key: string, id: string, params?: DbQuery) {
  for await (const pageObj of iteratePaginatedAPI(notion.databases.query, {
    auth: key,
    database_id: id,
    ...params,
  })) {
    if (pageObj.object === "page" && isFullPage(pageObj)) yield pageObj;
  }
}

type Image =
  | { type?: "file"; file: { url: string } }
  | { type?: "external"; external: { url: string } };

export function parseImageUrl(img: Required<Image>): string;
export function parseImageUrl(img: Image): string | undefined;
export function parseImageUrl(img: Image): string | undefined {
  if (img.type === "file") return img.file.url;
  if (img.type === "external") img.external.url;
  return undefined;
}
