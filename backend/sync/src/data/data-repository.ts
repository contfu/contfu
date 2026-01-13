import { CollectionFetchOpts } from "@contfu/sync";
import * as ds from "./db/data-datasource";

export type ExtendedFetchOpts = CollectionFetchOpts & {
  user: number;
};

export {
  createConnection as connectConsumerToCollection,
  countCollectionsForConsumer,
  createCollection,
  createSource,
  getConnectionsToCollections,
  getSourcesByIds,
} from "./db/data-datasource";

export async function getNextCollectionFetchOpts(pairs: [userId: number, collectionId: number][]) {
  const state = await ds.getConnectionsWithCollectionSyncInfo(pairs);

  const collectionFetchopts = new Array<ExtendedFetchOpts>();
  let current: ExtendedFetchOpts | null = null;
  for (const { consumer: _, lastItemChanged, ...s } of state) {
    // state is sorted by userId, collectionId, so we can safely assume that we
    // create only one fetchOpts per userId
    if (current == null || current.user !== s.user)
      collectionFetchopts.push((current = s as ExtendedFetchOpts));
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
