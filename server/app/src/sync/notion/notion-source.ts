import { EventType } from "@contfu/core";
import { MarkRequired } from "ts-essentials";
import { mergeGenerators } from "../../util/async/async-generators";
import { AsyncQueue } from "../../util/async/async-queue";
import { ItemEventExtended } from "../events";
import { CollectionFetchOpts, Source } from "../source";
import { iteratePages } from "./items";
import { DbQuery } from "./notion-helpers";

export class NotionSource implements Source {
  private _queue = new AsyncQueue<ItemEventExtended>();

  events = this._queue.createGenerator();

  async *fetch(opts: NotionPullOpts): AsyncIterable<ItemEventExtended> {
    const items = opts.since
      ? mergeGenerators(
          this._pull(opts, createdFilter(opts.since)),
          this._pull(opts, updatedFilter(opts.since))
        )
      : this._pull(opts);

    for await (const item of items) {
      yield {
        type: EventType.CHANGED,
        item,
        collection: opts.collectionId,
        src: opts.sourceId,
      };
    }
  }

  private _pull(opts: NotionPullOpts, filter?: DbQuery["filter"]) {
    return iteratePages(opts, { filter });
  }
}

function createdFilter(since: Date): DbQuery["filter"] {
  return {
    timestamp: "created_time",
    created_time: { after: since.toISOString() },
  };
}

function updatedFilter(since: Date): DbQuery["filter"] {
  return {
    and: [
      {
        timestamp: "created_time",
        created_time: { on_or_before: since.toISOString() },
      },
      {
        timestamp: "last_edited_time",
        last_edited_time: { after: since.toISOString() },
      },
    ],
  };
}

export const notionSource = new NotionSource();

export type NotionPullOpts = MarkRequired<
  CollectionFetchOpts,
  "ref" | "credentials"
>;
