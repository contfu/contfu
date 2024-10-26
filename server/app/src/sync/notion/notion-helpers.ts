import {
  Client,
  isFullPage,
  iteratePaginatedAPI,
} from "notion-client-web-fetch";
import type { QueryDatabaseParameters } from "notion-client-web-fetch/build/src/api-endpoints";
export const notion = new Client({});

export type DbQuery = Partial<
  Omit<QueryDatabaseParameters, "database_id" | "auth">
>;

export async function* iterateDb(key: Buffer, id: Buffer, params?: DbQuery) {
  for await (const pageObj of iteratePaginatedAPI(notion.databases.query, {
    auth: key.toString("hex"),
    database_id: id.toString("hex"),
    ...params,
  })) {
    if (pageObj.object === "page" && isFullPage(pageObj)) yield pageObj;
  }
}

type Image =
  | { type?: "file"; file: { url: string } }
  | { type?: "external"; external: { url: string } };

export function getImageUrl(img: Required<Image>): string;
export function getImageUrl(img: Image): string | undefined;
export function getImageUrl(img: Image): string | undefined {
  if (img.type === "file") return img.file.url;
  if (img.type === "external") img.external.url;
  return undefined;
}
