import type { AssetData, ItemData, ItemLinks } from "../types/content-types";
import { deleteNulls } from "../../util/object-helpers";
import { getCollectionName } from "../../features/collections/getCollectionName";
import { getOrCreateCollection } from "../../features/collections/getOrCreateCollection";
import { decodeId, encodeId } from "../ids";
import type { DbAsset, DbItem, ItemUpdate, NewAsset, NewItem } from "./schema";

export function assetToDb(asset: AssetData): NewAsset {
  return {
    id: decodeId(asset.id),
    itemId: decodeId(asset.itemId),
    canonical: asset.canonical,
    originalUrl: asset.originalUrl,
    format: asset.format,
    size: asset.size,
    createdAt: asset.createdAt,
  };
}

export function assetFromDb(dbo: DbAsset): AssetData {
  return {
    id: encodeId(dbo.id),
    itemId: encodeId(dbo.itemId),
    canonical: dbo.canonical,
    originalUrl: dbo.originalUrl,
    format: dbo.format,
    size: dbo.size,
    createdAt: dbo.createdAt,
  };
}

export async function itemToDb<T extends ItemData | Omit<ItemData, "links">>(
  item: T,
  ctx: any,
): Promise<ItemUpdate | NewItem> {
  const collectionId = item.collection
    ? await getOrCreateCollection(item.collection, ctx)
    : undefined;

  return {
    id: decodeId(item.id),
    ref: item.ref,
    collection: collectionId,
    props: item.props ? JSON.stringify(item.props) : null,
    content: item.content ? JSON.stringify(item.content) : null,
    changedAt: item.changedAt,
  } satisfies ItemUpdate as ItemUpdate | NewItem;
}

export async function itemFromDb(dbo: DbItem, ctx: any, links?: ItemLinks): Promise<ItemData> {
  const collectionName = dbo.collection ? await getCollectionName(dbo.collection, ctx) : "";

  return deleteNulls({
    id: encodeId(dbo.id),
    ref: dbo.ref,
    collection: collectionName,
    props: dbo.props ? JSON.parse(dbo.props) : {},
    content: dbo.content ? JSON.parse(dbo.content) : undefined,
    changedAt: dbo.changedAt,
    links: links ?? { content: [] },
  });
}
