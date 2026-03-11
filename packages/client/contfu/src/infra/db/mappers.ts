import { deleteNulls } from "../../util/object-helpers";
import { decodeId, encodeId } from "../ids";
import type { AssetData, ContentLinks, ItemData } from "../types/content-types";
import type { DbAsset, DbItem, ItemUpdate, NewAsset, NewItem } from "./schema";

export function assetToDb(asset: AssetData): NewAsset {
  return {
    id: decodeId(asset.id),
    originalUrl: asset.originalUrl,
    mediaType: asset.mediaType,
    ext: asset.ext,
    size: asset.size,
    ...(asset.data != null && { data: asset.data }),
    createdAt: asset.createdAt,
  };
}

export function assetFromDb(dbo: DbAsset): AssetData {
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
  } satisfies ItemUpdate as ItemUpdate | NewItem;
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
