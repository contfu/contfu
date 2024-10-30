import {
  combineLatest,
  defer,
  endWith,
  lastValueFrom,
  merge,
  repeat,
  Subject,
  tap,
  timer,
} from "rxjs";
import {
  countCollectionsForConsumer,
  getNextCollectionFetchOpts,
} from "../data/data-repository";
import { addItemIds } from "../data/db/data-datasource";
import { combine3ints } from "../util/numbers/numbers";
import { SortedSet } from "../util/structures/sorted-set";
import { EventType, ItemEvent } from "./events";
import { type NotionPullOpts, notionSource } from "./notion";
import { compressConsumerId } from "./sync";
import { MAX_COLLECTION_PULL_SIZE, MIN_FETCH_INTERVAL } from "./sync-constants";

export { getConnectionsToCollections } from "../data/data-repository";

export async function activateConsumer(accountId: number, consumerId: number) {
  const connCount = await countCollectionsForConsumer(accountId, consumerId);
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

export const sync$ = defer(() =>
  combineLatest([timer(MIN_FETCH_INTERVAL), syncAllActiveConsumers()])
).pipe(repeat());

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
  const idsToAdd = new Map<number, Buffer>();
  await lastValueFrom(
    merge(...opts.map((o) => notionSource.fetch(o as NotionPullOpts)))
      .pipe(
        tap((event) => {
          eventsSubject.next(event);
          if (event.type === EventType.CREATED) {
            const ids = idsToAdd.get(event.collection) ?? Buffer.alloc(0);
            idsToAdd.set(event.collection, Buffer.concat([ids, event.item.id]));
          }
        })
      )
      .pipe(endWith(null))
  );

  for (const [collectionId, itemIds] of idsToAdd.entries()) {
    const [[accountId]] = consumerIds;
    await addItemIds(accountId, collectionId, itemIds);
  }
}

const [compressConsumerIdWithCount, expandConsumerIdWithCount] = combine3ints(
  32,
  10,
  10
);
