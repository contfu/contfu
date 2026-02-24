import type {
  ContfuClient,
  ContfuCollectionClient,
  ContfuItemsClient,
  ItemWithRelations,
  QueryOptions,
  QueryResult,
} from "./domain/query-types";
import { db } from "./infra/db/db";
import { findItems } from "./features/items/findItems";
import { getItemById } from "./features/items/getItemById";
import { createHttpClient } from "./infra/http/query-client";

function createLocalClient(ctx = db): ContfuClient {
  function createItemsClient(collectionFilter?: string): ContfuItemsClient {
    return {
      async find(options: QueryOptions = {}): Promise<QueryResult> {
        const opts = collectionFilter
          ? {
              ...options,
              filter: options.filter
                ? `collection = "${collectionFilter}" && (${options.filter})`
                : `collection = "${collectionFilter}"`,
            }
          : options;
        return findItems(opts, ctx);
      },

      async get(
        id: string,
        options?: Pick<QueryOptions, "include" | "with">,
      ): Promise<ItemWithRelations | null> {
        return getItemById(id, options, ctx);
      },
    };
  }

  return {
    items: createItemsClient(),
    collections(name: string): ContfuCollectionClient {
      return {
        items: createItemsClient(name),
      };
    },
  };
}

export function contfu(url?: string, options?: { apiKey?: string }): ContfuClient {
  if (url) {
    return createHttpClient(url, options?.apiKey);
  }
  return createLocalClient();
}
