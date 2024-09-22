import {
  Item,
  NotionCollectionConfig,
  isPageData,
  type NotionConfig,
} from "@contfu/core";
import { Observable, defer, from, merge, reduce, repeat, tap } from "rxjs";
import { idFromUuid } from "../mappings";
import { Source } from "../source";
import { iteratePages } from "./items";
import { iterateDb, type DbQuery } from "./notion";

const PRUNE_INTERVAL = 24 * 60 * 60 * 1000;
const PULL_INTERVAL = 5 * 60 * 1000;

export class NotionSource implements Source<NotionCollectionConfig> {
  readonly id: number;
  readonly key: string;
  readonly collections: NotionCollectionConfig[];

  constructor({ id, key, collections }: NotionConfig) {
    this.id = id;
    this.key = key;
    this.collections = collections;
  }

  pullCollectionIds(collection: NotionCollectionConfig) {
    return defer(() =>
      from(
        iterateDb(this.key, collection.dbId, {
          filter_properties: ["title"],
        })
      )
    ).pipe(
      reduce((ids, { id }) => [...ids, idFromUuid(id)], [] as string[]),
      repeat({ delay: PRUNE_INTERVAL })
    );
  }

  pull(collection: NotionCollectionConfig, since?: number): Observable<Item> {
    return defer(() => {
      return since
        ? merge(
            this._pull(collection, createdFilter(since)),
            this._pull(collection, updatedFilter(since))
          )
        : this._pull(collection);
    }).pipe(
      tap((data) => {
        if (isPageData(data))
          since = Math.max(since ?? 0, data.changedAt, data.createdAt);
      }),
      repeat({ delay: PULL_INTERVAL })
    );
  }

  async fetchAsset(url: string): Promise<ReadableStream> {
    const res = await fetch(url);
    return res.body!;
  }

  private _pull(
    collection: NotionCollectionConfig,
    filter?: DbQuery["filter"]
  ) {
    return iteratePages(this.key, collection, {
      filter,
      src: this.id,
      collection: collection.id,
    });
  }
}

function createdFilter(since: number): DbQuery["filter"] {
  return {
    timestamp: "created_time",
    created_time: { after: new Date(since).toISOString() },
  };
}

function updatedFilter(since: number): DbQuery["filter"] {
  return {
    and: [
      {
        timestamp: "created_time",
        created_time: { on_or_before: new Date(since).toISOString() },
      },
      {
        timestamp: "last_edited_time",
        last_edited_time: { after: new Date(since).toISOString() },
      },
    ],
  };
}
