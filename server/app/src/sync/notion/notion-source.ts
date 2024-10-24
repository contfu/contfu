import { EventType } from "@contfu/core";
import { MarkRequired } from "ts-essentials";
import { mergeGenerators } from "../../util/async/async-generators";
import { ItemEvent } from "../events";
import { CollectionFetchOpts, Source } from "../source";
import { iteratePages } from "./items";
import { DbQuery } from "./notion-helpers";

export class NotionSource extends Source {
  async *fetch(opts: NotionPullOpts): AsyncGenerator<ItemEvent> {
    const items = opts.since
      ? mergeGenerators(
          pull(opts, createdAfter(opts.since)),
          pull(opts, updatedAfter(opts.since))
        )
      : pull(opts);

    for await (const item of items) {
      yield {
        type: EventType.CHANGED,
        item,
        account: opts.accountId,
        collection: opts.collectionId,
      };
    }
  }
}

function pull(opts: NotionPullOpts, filter?: DbQuery["filter"]) {
  return iteratePages(opts, { filter });
}

function createdAfter(since: Date): DbQuery["filter"] {
  return {
    timestamp: "created_time",
    created_time: { after: since.toISOString() },
  };
}

function updatedAfter(since: Date): DbQuery["filter"] {
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
