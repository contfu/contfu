import { CollectionFetchOpts } from "@contfu/sync";
import * as ds from "./db/data-datasource";

const ID = Number(Bun.env.ID ?? 1);

export type ExtendedFetchOpts = CollectionFetchOpts & {
  account: number;
};

export {
  createConnection as connectConsumerToCollection,
  countCollectionsForConsumer,
  createCollection,
  createSource,
  getConnectionsToCollections,
  getSourcesByIds,
} from "./db/data-datasource";

export async function getNextCollectionFetchOpts(
  pairs: [accountId: number, collectionId: number][]
) {
  const state = await ds.getConnectionsWithCollectionSyncInfo(pairs);

  const collectionFetchopts = new Array<ExtendedFetchOpts>();
  let current: ExtendedFetchOpts | null = null;
  for (const { consumer, lastItemChanged, ...s } of state) {
    // state is sorted by accountId, collectionId, so we can safely assume that we
    // create only one fetchOpts per accountId
    if (current == null || current.account !== s.account)
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
