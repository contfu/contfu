import {
  ChangedEvent,
  EventType,
  ListIdsEvent,
  NotionCollectionConfig,
} from "@contfu/core";
import { map, merge } from "rxjs";
import { DbConsumer } from "../access/db/access-schema";
import { buildSource } from "../sync/source";
import { connectConsumer, getSourcesByIds } from "./data-repository";

export async function subscribeConsumerToCollections({
  id,
  accountId,
}: DbConsumer) {
  const connections = await connectConsumer({ id, accountId });
  const collections = connections.map((c) => c.collection);
  const sourceList = await getSourcesByIds(accountId, [
    ...new Set(collections.map((c) => c.sourceId)),
  ]);
  const sources = sourceList.map((src) => {
    return buildSource({
      ...src,
      key: src.key!,
      collections: connections
        .filter(({ collection }) => collection.sourceId === src.id)
        .map(({ lastFetch, collection }) => {
          const opts = collection.opts as Omit<NotionCollectionConfig, "id">;
          return {
            ...opts,
            id: collection.id,
            lastFetch: lastFetch?.getTime(),
          };
        }),
    });
  });
  return merge(
    ...sources.flatMap((src) =>
      src.collections.flatMap((col) => [
        src.pull(col, col.lastFetch).pipe(
          map(
            (item) =>
              ({
                type: EventType.CHANGED,
                src: src.id,
                collection: col.id,
                item,
              } satisfies ChangedEvent)
          )
        ),
        src.pullCollectionIds(col).pipe(
          map(
            (ids) =>
              ({
                type: EventType.LIST_IDS,
                src: src.id,
                collection: col.id,
                ids,
              } satisfies ListIdsEvent)
          )
        ),
      ])
    )
  );
}
