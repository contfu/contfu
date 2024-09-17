import {
  Item,
  NotionCollectionConfig,
  isPageData,
  type NotionConfig,
} from "@contfu/core";
import { Observable, defer, from, merge, reduce, repeat, tap } from "rxjs";
import { Source } from "../source";
import { iterateDb, type DbQuery } from "./notion";
import { iteratePages } from "./pages";

const PRUNE_INTERVAL = 24 * 60 * 60 * 1000;
const PULL_INTERVAL = 5 * 60 * 1000;

export class NotionSource<C extends string> implements Source<C> {
  readonly id: string;
  readonly key: string;
  readonly collections: Record<C, NotionCollectionConfig>;

  constructor({ id, key, collections }: NotionConfig<C>) {
    this.id = id;
    this.key = key;
    this.collections = collections;
  }

  pullCollectionIds(collection: C) {
    return defer(() =>
      from(
        iterateDb(this.key, this.collections[collection].dbId, {
          filter_properties: ["title"],
        })
      )
    ).pipe(
      reduce((ids, { id }) => [...ids, id], [] as string[]),
      repeat({ delay: PRUNE_INTERVAL })
    );
  }

  pull(collection: C, since?: number): Observable<Item> {
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

  private _pull(collection: C, filter?: DbQuery["filter"]) {
    const { dbId } = this.collections[collection];
    return iteratePages(this.key, this.collections[collection], {
      filter,
      src: this.id,
      collection,
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
