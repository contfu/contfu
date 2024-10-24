import { CollectionFetchOpts } from "../sync/source";
import * as ds from "./db/data-datasource";

const ID = Number(Bun.env.ID ?? 1);

export {
  createConnection as connectConsumerToCollection,
  createCollection,
  createSource,
  getConnectionsToCollections,
  getSourcesByIds,
} from "./db/data-datasource";

export async function getNextCollectionFetchOpts(
  pairs: [accountId: number, collectionId: number][]
) {
  const state = await ds.getConnectionsWithCollectionSyncInfo(pairs);

  const collectionFetchopts = new Array<CollectionFetchOpts>();
  let current: CollectionFetchOpts | null = null;
  for (const { consumerId, lastItemChanged, ...s } of state) {
    // state is sorted by accountId, collectionId, so we can safely assume that we
    // create only one fetchOpts per accountId
    if (current == null || current.accountId !== s.accountId)
      collectionFetchopts.push((current = s as CollectionFetchOpts));
    if (lastItemChanged != null) {
      current.since =
        current.since == null
          ? lastItemChanged
          : current.since < lastItemChanged
          ? current.since
          : lastItemChanged;
    }
  }
  return collectionFetchopts;
}
