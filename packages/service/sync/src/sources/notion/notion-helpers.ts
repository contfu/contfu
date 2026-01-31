import { Client, isFullDatabase, isFullPage, iteratePaginatedAPI } from "@notionhq/client";
import type { QueryDataSourceParameters } from "@notionhq/client/build/src/api-endpoints";

export const notion = new Client({});

export type DbQuery = Partial<Omit<QueryDataSourceParameters, "data_source_id" | "auth">>;

export async function* iterateDb(key: string, ref: Buffer, params?: DbQuery) {
  // ref is a database_id, we need to get the data_source_id from it
  const db = await notion.databases.retrieve({
    auth: key,
    database_id: ref.toString("hex"),
  });
  if (!isFullDatabase(db)) return;

  const dataSourceId = db.data_sources[0]?.id;
  if (!dataSourceId) {
    throw new Error(`No data sources found for database ${ref.toString("hex")}`);
  }

  for await (const pageObj of iteratePaginatedAPI(notion.dataSources.query, {
    auth: key,
    data_source_id: dataSourceId,
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
  if (img.type === "external") return img.external.url;
  return undefined;
}
