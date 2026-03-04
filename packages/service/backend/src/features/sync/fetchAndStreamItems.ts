import { SourceType } from "@contfu/core";
import {
  applyMappings,
  matchesFilters,
  validateSourceItem,
  type SourceItemValidationError,
} from "@contfu/svc-core";
import { createLogger } from "../../infra/logger/index";
import { getItemRefForSource, notionSource, strapiSource, webSource } from "@contfu/svc-sources";
import type { UserSyncItem } from "../../infra/sync-worker/messages";
import { isItemQuotaExceeded } from "../../infra/nats/quota-kv";
import { getRateLimitForSourceType } from "../../infra/webhook-queue/types";
import type { ConsumerSyncConfig } from "./getConsumerSyncConfig";

const log = createLogger("sync-fetch");

/**
 * Fetches items from upstream sources for a consumer's sync config.
 * Iterates source groups, creates appropriate source adapter calls,
 * applies influx filters, and yields items tagged with target collection IDs.
 *
 * Each source collection is fetched only once; results are fanned out
 * to all matching target collections.
 */
export class ValidationErrorCollector {
  private groups = new Map<
    string,
    {
      influxId: number;
      property: string;
      cast: string;
      sourceProperty: string;
      samples: [number, string][];
      total: number;
    }
  >();

  add(influxId: number, err: SourceItemValidationError, timestamp: number, ref: string) {
    const key = `${influxId}:${err.property}:${err.cast}`;
    let g = this.groups.get(key);
    if (!g) {
      g = {
        influxId,
        property: err.property,
        cast: err.cast,
        sourceProperty: err.sourceProperty,
        samples: [],
        total: 0,
      };
      this.groups.set(key, g);
    }
    g.total++;
    if (g.samples.length < 10) g.samples.push([timestamp, ref]);
  }

  getGroups() {
    return this.groups.values();
  }
  get size() {
    return this.groups.size;
  }
}

export async function* fetchAndStreamItems(
  config: ConsumerSyncConfig,
  collector?: ValidationErrorCollector,
): AsyncGenerator<UserSyncItem> {
  const throttle = new FullSyncThrottle();

  for (const group of config.sourceGroups) {
    for (const sc of group.sourceCollections) {
      try {
        const items = fetchSourceCollection(group, sc.collectionRef);

        for await (const item of items) {
          if (await isItemQuotaExceeded(config.userId)) {
            log.info({ userId: config.userId }, "Item quota exceeded, aborting full sync");
            return;
          }
          await throttle.wait(group.sourceType);
          const sourceRef = getItemRefForSource({
            sourceType: group.sourceType,
            rawRef: item.ref,
            sourceUrl: group.sourceUrl,
            collectionRef: sc.collectionRef,
          });

          // Fan out to each target collection, applying filters
          for (const target of sc.targets) {
            if (
              target.filters &&
              target.filters.length > 0 &&
              !matchesFilters(item.props, target.filters)
            ) {
              continue;
            }

            // Validate before applying mappings — drop items with cast failures
            if (collector && target.mappings) {
              const errors = validateSourceItem(item.props, target.mappings);
              if (errors.length > 0) {
                for (const err of errors)
                  collector.add(target.influxId, err, item.changedAt, sourceRef.ref);
                continue;
              }
            }

            const mappedProps = applyMappings(item.props, target.mappings);

            yield {
              ...item,
              props: mappedProps,
              ref: sourceRef.ref,
              sourceType: sourceRef.sourceType,
              user: config.userId,
              collection: target.collectionId,
              includeRef: target.includeRef,
            };
          }
        }
      } catch (error) {
        log.error({ err: error, sourceCollectionId: sc.sourceCollectionId }, "Sync fetch error");
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

class FullSyncThrottle {
  private nextAllowedAt = new Map<number, number>();

  async wait(sourceType: SourceType): Promise<void> {
    const rateLimit = getRateLimitForSourceType(sourceType);
    if (!rateLimit || rateLimit.maxRequests <= 0 || rateLimit.windowMs <= 0) {
      return;
    }

    const minIntervalMs = Math.ceil(rateLimit.windowMs / rateLimit.maxRequests);
    const now = Date.now();
    const nextAt = this.nextAllowedAt.get(sourceType) ?? now;
    const waitMs = Math.max(0, nextAt - now);
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this.nextAllowedAt.set(sourceType, Math.max(nextAt, now) + minIntervalMs);
  }
}
