import { deleteNulls } from "../../util/object-helpers";
import { decodeId, encodeId } from "../ids";
import type { FileData, ContentLinks, ItemData } from "../types/content-types";
import type { DbFile, DbItem, ItemUpdate, NewFile, NewItem } from "./schema";

export function fileToDb(file: FileData): NewFile {
  return {
    id: decodeId(file.id),
    originalUrl: file.originalUrl,
    mediaType: file.mediaType,
    ext: file.ext,
    size: file.size,
    ...(file.data != null && { data: file.data }),
    createdAt: file.createdAt,
  };
}

export function fileFromDb(dbo: DbFile): FileData {
  return {
    id: encodeId(dbo.id),
    originalUrl: dbo.originalUrl,
    mediaType: dbo.mediaType,
    ext: dbo.ext,
    size: dbo.size,
    createdAt: dbo.createdAt,
  };
}

export function itemToDb<T extends ItemData | Omit<ItemData, "links">>(
  item: T,
  _ctx: any,
): ItemUpdate | NewItem {
  return {
    id: decodeId(item.id),
    connectionType: item.connectionType ?? null,
    ref: item.ref ?? null,
    collection: item.collection,
    props: item.props,
    content: item.content ? item.content : null,
    changedAt: item.changedAt,
  } satisfies ItemUpdate;
}

export function itemFromDb(dbo: DbItem, _ctx: any, links?: ContentLinks): ItemData {
  return deleteNulls({
    id: encodeId(dbo.id),
    connectionType: dbo.connectionType ?? null,
    ref: dbo.ref ?? null,
    collection: dbo.collection,
    props: dbo.props,
    content: dbo.content ? dbo.content : undefined,
    changedAt: dbo.changedAt,
    links: links ?? [],
  });
}
