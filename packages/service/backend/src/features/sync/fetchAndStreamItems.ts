import { SourceType, matchesFilters } from "@contfu/svc-core";
import type { UserSyncItem } from "../../infra/sync-worker/messages";
import { NotionSource } from "@contfu/svc-sources/notion";
import { StrapiSource } from "@contfu/svc-sources/strapi";
import { WebSource } from "@contfu/svc-sources/web";
import type { ConsumerSyncConfig } from "./getConsumerSyncConfig";

const notionSource = new NotionSource();
const strapiSource = new StrapiSource();
const webSource = new WebSource();

/**
 * Fetches items from upstream sources for a consumer's sync config.
 * Iterates source groups, creates appropriate source adapter calls,
 * applies influx filters, and yields items tagged with target collection IDs.
 *
 * Each source collection is fetched only once; results are fanned out
 * to all matching target collections.
 */
export async function* fetchAndStreamItems(
  config: ConsumerSyncConfig,
): AsyncGenerator<UserSyncItem> {
  for (const group of config.sourceGroups) {
    for (const sc of group.sourceCollections) {
      try {
        const items = fetchSourceCollection(group, sc.collectionRef);

        for await (const item of items) {
          // Fan out to each target collection, applying filters
          for (const target of sc.targets) {
            if (
              target.filters &&
              target.filters.length > 0 &&
              !matchesFilters(item.props, target.filters)
            ) {
              continue;
            }

            yield {
              ...item,
              user: config.userId,
              collection: target.collectionId,
              includeRef: target.includeRef,
            };
          }
        }
      } catch (error) {
        console.error(`Sync fetch error for source collection ${sc.sourceCollectionId}:`, error);
        // Skip failed source collection, continue with others
      }
    }
  }
}

function fetchSourceCollection(
  group: ConsumerSyncConfig["sourceGroups"][number],
  collectionRef: Buffer | null,
) {
  // Use a dummy collection ID — we override it per-target in the generator
  const collection = 0;

  if (group.sourceType === SourceType.NOTION) {
    return notionSource.fetch({
      collection,
      ref: collectionRef!,
      credentials: group.credentials?.toString("utf-8") ?? "",
    });
  }

  if (group.sourceType === SourceType.STRAPI) {
    return strapiSource.fetch({
      collection,
      ref: collectionRef!,
      url: group.sourceUrl!,
      credentials: group.credentials!,
    });
  }

  // Web source
  return webSource.fetch({
    collection,
    ref: collectionRef!,
    url: group.sourceUrl!,
    credentials: group.credentials ?? undefined,
  });
}
