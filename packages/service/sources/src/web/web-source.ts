import type { Item } from "@contfu/core";
import { CollectionSchema, PropertyType } from "@contfu/svc-core";
import { Source } from "../source";
import type { WebFetchOpts } from "./web";
import { iterateItems } from "./web-items";
import {
  classifyUrlContentType,
  parseRefUrls,
  webHead,
  type ContentProcessor,
} from "./web-helpers";

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
   * Classifies URLs by extension/pattern and falls back to a HEAD probe when uncertain.
   */
  async getCollectionSchema(opts: WebFetchOpts): Promise<CollectionSchema> {
    const urls = parseRefUrls(opts.ref);
    if (urls.length === 0) {
      return buildSchema(null);
    }

    // Classify all URLs by pattern
    const types: ContentProcessor[] = urls.map(classifyUrlContentType);

    // Probe an uncertain URL via HEAD if needed
    let resolved = types;
    const uncertainIdx = types.findIndex((t) => t === null);
    if (uncertainIdx !== -1) {
      const probeUrl = urls[uncertainIdx];
      const probed = await webHead(probeUrl, {
        baseUrl: opts.url,
        authType: opts.authType,
        credentials: opts.credentials,
      });
      resolved = types.map((t) => t ?? probed);
    }

    // Determine dominant type (all-same → use it, otherwise mixed → null)
    const unique = new Set(resolved.filter(Boolean));
    const dominant = unique.size === 1 ? [...unique][0] : null;

    return buildSchema(dominant);
  }
}

function buildSchema(type: ContentProcessor): CollectionSchema {
  const S = PropertyType.STRING;
  const SN = PropertyType.STRING | PropertyType.NULL;

  switch (type) {
    case "html":
      return {
        slug: S,
        title: SN,
        description: SN,
        favicon: SN,
        content: SN,
      };
    case "markdown":
      return {
        slug: S,
        title: SN,
        description: SN,
        content: SN,
      };
    case "json":
      return {
        slug: S,
        data: SN,
      };
    default:
      // mixed / unknown — union of all fields, all nullable
      return {
        slug: S,
        title: SN,
        description: SN,
        favicon: SN,
        content: SN,
        data: SN,
      };
  }
}
