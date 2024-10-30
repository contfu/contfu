import { CollectionSchema, Item } from "@contfu/core";
import { from, map, merge, Observable } from "rxjs";
import { changedEvent, createdEvent, ItemEvent } from "../events";
import { Source } from "../source";
import { NotionPullOpts } from "./notion";
import { getCollectionSchema } from "./notion-collections";
import { DbQuery } from "./notion-helpers";
import { iteratePages } from "./notion-items";
export class NotionSource implements Source {
  fetch(opts: NotionPullOpts): Observable<ItemEvent> {
    return opts.since
      ? merge(
          pull(opts, createdEvent, createdAfter(opts.since)),
          pull(opts, changedEvent, updatedAfter(opts.since))
        )
      : pull(opts, createdEvent);
  }

  async getCollectionSchema(opts: NotionPullOpts): Promise<CollectionSchema> {
    return getCollectionSchema(opts.credentials, opts.ref);
  }
}

function pull(
  opts: NotionPullOpts,
  eventFactory: (opts: NotionPullOpts, item: Item) => ItemEvent,
  filter?: DbQuery["filter"]
) {
  return from(iteratePages(opts, { filter })).pipe(
    map((item) => eventFactory(opts, item))
  );
}

function createdAfter(since: number): DbQuery["filter"] {
  return {
    timestamp: "created_time",
    created_time: { after: new Date(since).toISOString() },
  };
}

function updatedAfter(since: number): DbQuery["filter"] {
  const isoSince = new Date(since).toISOString();
  return {
    and: [
      {
        timestamp: "created_time",
        created_time: { on_or_before: isoSince },
      },
      {
        timestamp: "last_edited_time",
        last_edited_time: { after: isoSince },
      },
    ],
  };
}

export const notionSource = new NotionSource();
