import { getNextCollectionFetchOpts } from "../data/data-repository";
import { countConnectionsForConsumer } from "../data/db/data-datasource";
import { combine2ints, combine3ints } from "../util/numbers";
import { SortedSet } from "../util/structures/sorted-set";
import { NotionPullOpts, notionSource } from "./notion";
import { MAX_COLLECTION_PULL_SIZE } from "./sync-constants";

export async function activateConsumer(accountId: number, consumerId: number) {
  const connCount = await countConnectionsForConsumer(accountId, consumerId);
  activeConsumers.add(compressConsumer(accountId, consumerId, connCount));
}

/**
 * Active consumers are stored in binary format to save memory.
 * Every buffer consists of the account id (4 byte) and their active consumers.
 * Every consumer has a consumer id (1 byte) and the count of connected collections (1 byte).
 **/
const activeConsumers = new SortedSet<number>({
  key: (x) => {
    const [accountId, consumerId] = expandConsumer(x);
    return compressConsumerId(accountId, consumerId);
  },
});

async function syncActiveConsumers() {
  const consumers = [...activeConsumers];
  let partition: [number, number][] = [];
  let connectedCollections = 0;
  if (activeConsumers.length === 0) return;
  for (const consumer of consumers) {
    const [accountId, consumerId, count] = expandConsumer(consumer);
    if (partition.length + count > MAX_COLLECTION_PULL_SIZE) {
      await syncConsumers(partition);
      partition = [];
      connectedCollections = 0;
      continue;
    }
    connectedCollections += count;
    partition.push([accountId, consumerId]);
  }
  if (partition.length > 0) await syncConsumers(partition);
}

async function syncConsumers(
  consumerIds: [accountId: number, consumerId: number][]
) {
  const state = await getNextCollectionFetchOpts(consumerIds);
  for (const s of state) {
    if (s.type === "notion") {
      notionSource.fetch(s as NotionPullOpts);
    }
  }
}

const [compressConsumerId] = combine2ints(32, 10);
const [compressConsumer, expandConsumer] = combine3ints(32, 10, 10);
