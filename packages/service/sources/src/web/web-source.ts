import type { Item } from "@contfu/core";
import { CollectionSchema, PropertyType } from "@contfu/svc-core";
import { Source } from "../source";
import type { WebFetchOpts } from "./web";
import { iterateItems } from "./web-items";

/**
 * Web source adapter for fetching content from websites.
 */
export class WebSource implements Source<WebFetchOpts> {
  /**
   * Fetch items from web URLs.
   * Items are sorted ascending by createdAt as required by the Source interface.
   */
  fetch(opts: WebFetchOpts): AsyncGenerator<Item> {
    return iterateItems(opts);
  }

  /**
   * Get the schema for a web collection.
   * Web pages have a standard schema with slug, title, description, and optional data.
   */
  async getCollectionSchema(_opts: WebFetchOpts): Promise<CollectionSchema> {
    // Web pages have a predictable schema
    return {
      // Slug is always present (extracted from URL)
      slug: PropertyType.STRING,
      // Title is optional (extracted from <title> or <h1>)
      title: PropertyType.STRING | PropertyType.NULL,
      // Description is optional (extracted from meta tag)
      description: PropertyType.STRING | PropertyType.NULL,
      // Data is optional (only for JSON responses)
      data: PropertyType.STRING | PropertyType.NULL,
    };
  }
}
