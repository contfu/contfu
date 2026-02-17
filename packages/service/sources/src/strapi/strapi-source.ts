import type { Item } from "@contfu/core";
import type { CollectionSchema } from "@contfu/svc-core";
import { Source } from "../source";
import type { StrapiFetchOpts } from "./strapi";
import { getCollectionSchema } from "./strapi-collections";
import { iterateItems } from "./strapi-items";

/**
 * Strapi CMS source adapter.
 */
export class StrapiSource implements Source<StrapiFetchOpts> {
  /**
   * Fetch items from a Strapi content type.
   * Items are sorted ascending by createdAt as required by the Source interface.
   */
  fetch(opts: StrapiFetchOpts): AsyncGenerator<Item> {
    // Use a 10 second buffer similar to Notion to avoid race conditions
    const until = Math.floor(Date.now() / 1000 - 10) * 1000;
    const untilDate = new Date(until).toISOString();

    if (opts.since) {
      // Incremental sync: fetch entries updated since the given timestamp
      return iterateItems(opts, {
        since: new Date(opts.since).toISOString(),
        until: untilDate,
        sort: "createdAt:asc",
      });
    }

    // Full sync: fetch all entries up to the buffer time
    return iterateItems(opts, {
      until: untilDate,
      sort: "createdAt:asc",
    });
  }

  /**
   * Get the schema for a Strapi content type.
   */
  async getCollectionSchema(opts: StrapiFetchOpts): Promise<CollectionSchema> {
    return getCollectionSchema(opts.url, opts.ref, opts.credentials);
  }
}
