import { combineLatest, defer, repeat, Subject, timer } from "rxjs";
import { getNextCollectionFetchOpts } from "../data/data-repository";
import { countConnectionsForConsumer } from "../data/db/data-datasource";
import { mergeGenerators } from "../util/async/async-generators";
import { combine3ints } from "../util/numbers/numbers";
import { SortedSet } from "../util/structures/sorted-set";
import { ItemEvent } from "./events";
import { type NotionPullOpts, notionSource } from "./notion";
import { compressConsumerId } from "./sync";
import { MAX_COLLECTION_PULL_SIZE, MIN_SYNC_INTERVAL } from "./sync-constants";

export { getConnectionsToCollections } from "../data/data-repository";

export async function activateConsumer(accountId: number, consumerId: number) {
  const connCount = await countConnectionsForConsumer(accountId, consumerId);
  activeConsumers.add(
    compressConsumerIdWithCount(accountId, consumerId, connCount)
  );
}

const eventsSubject = new Subject<ItemEvent>();
export const events$ = eventsSubject.asObservable();

/**
 * Active consumers are stored in binary format to save memory.
 * Every buffer consists of the account id (4 byte) and their active consumers.
 * Every consumer has a consumer id (1 byte) and the count of connected collections (1 byte).
 **/
const activeConsumers = new SortedSet<number>({
  key: (x) => {
    const [accountId, consumerId] = expandConsumerIdWithCount(x);
    return compressConsumerId(accountId, consumerId);
  },
});

export function sync() {
  return defer(() =>
    combineLatest([timer(MIN_SYNC_INTERVAL), syncAllActiveConsumers()])
  ).pipe(repeat());
}

async function syncAllActiveConsumers() {
  if (activeConsumers.length === 0) return;
  const consumers = [...activeConsumers];
  let partition: [number, number][] = [];
  let connectedCollections = 0;
  for (const consumer of consumers) {
    const [accountId, consumerId, count] = expandConsumerIdWithCount(consumer);
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
  const opts = await getNextCollectionFetchOpts(consumerIds);
  for await (const event of mergeGenerators(
    ...opts.map((o) => notionSource.fetch(o as NotionPullOpts))
  ))
    eventsSubject.next(event);
}

const [compressConsumerIdWithCount, expandConsumerIdWithCount] = combine3ints(
  32,
  10,
  10
);
