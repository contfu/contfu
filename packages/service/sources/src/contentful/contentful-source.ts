import type { Item } from "@contfu/core";
import type { CollectionSchema } from "@contfu/svc-core";
import { Source } from "../source";
import type { ContentfulFetchOpts } from "./contentful";
import { getCollectionSchema } from "./contentful-collections";
import { iterateItems } from "./contentful-items";

export class ContentfulSource implements Source<ContentfulFetchOpts> {
  fetch(opts: ContentfulFetchOpts): AsyncGenerator<Item> {
    const until = Math.floor(Date.now() / 1000 - 10) * 1000;
    const untilDate = new Date(until).toISOString();

    if (opts.since) {
      return iterateItems(opts, {
        "sys.updatedAt[gte]": new Date(opts.since).toISOString(),
        "sys.updatedAt[lte]": untilDate,
        order: "sys.createdAt",
      });
    }

    return iterateItems(opts, {
      "sys.updatedAt[lte]": untilDate,
      order: "sys.createdAt",
    });
  }

  async getCollectionSchema(opts: ContentfulFetchOpts): Promise<CollectionSchema> {
    return getCollectionSchema(
      opts.spaceId,
      opts.environmentId ?? "master",
      opts.ref,
      opts.credentials,
    );
  }
}
