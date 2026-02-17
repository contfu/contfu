import type { Item } from "@contfu/core";
import { CollectionSchema } from "@contfu/svc-core";
import { Source } from "../source";
import { NotionFetchOpts } from "./notion";
import { getCollectionSchema } from "./notion-collections";
import { DbQuery } from "./notion-helpers";
import { iteratePages } from "./notion-items";

export class NotionSource implements Source<NotionFetchOpts> {
  fetch(opts: NotionFetchOpts): AsyncGenerator<Item> {
    // 10 seconds ago, since Notion timestamps seem to be only updated every 10 seconds
    // and we don't want to miss pages or fetch the same page twice.
    const until = Math.floor(Date.now() / 1000 - 10) * 1000;
    return opts.since
      ? pull(opts, createdOrUpdated(opts.since, until))
      : pull(opts, onOrBefore(until));
  }

  async getCollectionSchema(opts: NotionFetchOpts): Promise<CollectionSchema> {
    return getCollectionSchema(opts.credentials, opts.ref);
  }
}

function pull(opts: NotionFetchOpts, filter?: DbQuery["filter"]) {
  return iteratePages(opts, {
    filter,
    sorts: [{ timestamp: "created_time", direction: "ascending" }],
  });
}

function createdOrUpdated(since: number, until: number): DbQuery["filter"] {
  return {
    and: [
      {
        timestamp: "created_time",
        created_time: {
          after: formatDate(since),
          on_or_before: formatDate(until),
        },
      },
    ],
  };
}

function onOrBefore(until: number) {
  return {
    and: [
      {
        timestamp: "last_edited_time",
        last_edited_time: { on_or_before: formatDate(until) },
      },
      {
        timestamp: "created_time",
        created_time: { on_or_before: formatDate(until) },
      },
    ],
  } satisfies DbQuery["filter"];
}

function formatDate(date: number): string {
  return new Date(date).toISOString();
}
