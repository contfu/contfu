import { ConnectionType } from "@contfu/core";
import {
  applyMappings,
  matchesFilters,
  validateSourceItem,
  type SourceItemValidationError,
} from "@contfu/svc-core";
import { createLogger } from "../../infra/logger/index";
import { getItemRefForSource, notionSource, strapiSource, webSource } from "@contfu/svc-sources";
import type { UserSyncItem } from "../../infra/sync-worker/messages";
import { checkQuota } from "../quota/checkQuota";
import { addItemsCount } from "../quota/addItemsCount";
import { getRateLimitForConnectionType } from "../../infra/webhook-queue/types";
import type { SyncConfig } from "./getSyncConfig";

const PAGE_SIZE = 100;

const log = createLogger("sync-fetch");

/**
 * Fetches items from upstream sources for a sync config.
 * Iterates source groups, creates appropriate source adapter calls,
 * applies flow filters, and yields items tagged with target collection IDs.
 *
 * Each source collection is fetched only once; results are fanned out
 * to all matching target collections.
 */
export class ValidationErrorCollector {
  private groups = new Map<
    string,
    {
      flowId: number;
      property: string;
      cast: string;
      sourceProperty: string;
      samples: [number, string][];
      total: number;
    }
  >();

  add(flowId: number, err: SourceItemValidationError, timestamp: number, ref: string) {
    const key = `${flowId}:${err.property}:${err.cast}`;
    let g = this.groups.get(key);
    if (!g) {
      g = {
        flowId,
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
  config: SyncConfig,
  collector?: ValidationErrorCollector,
): AsyncGenerator<UserSyncItem> {
  const throttle = new FullSyncThrottle();
  let quotaExhausted = false;

  for (const group of config.connectionGroups) {
    if (quotaExhausted) break;

    for (const sc of group.sourceCollections) {
      if (quotaExhausted) break;

      let consumed = 0;
      let reserved = 0;

      try {
        const items = fetchSourceCollection(group, sc.collectionRef);

        for await (const item of items) {
          // Reserve more quota slots when the current reservation is exhausted
          if (consumed >= reserved) {
            const quota = await checkQuota(config.userId, "items");
            const isUnlimited = quota.max <= 0;
            if (!isUnlimited && !quota.allowed) {
              log.info({ userId: config.userId }, "Item quota exceeded, stopping sync");
              quotaExhausted = true;
              break;
            }
            const toReserve = isUnlimited
              ? PAGE_SIZE
              : Math.min(PAGE_SIZE, quota.max - quota.current);
            await addItemsCount(config.userId, toReserve);
            reserved += toReserve;
          }
          consumed++;

          await throttle.wait(group.connectionType);
          const sourceRef = getItemRefForSource({
            sourceType: group.connectionType,
            rawRef: item.ref,
            sourceUrl: group.connectionUrl,
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
            // Validation failures still count against quota (source was fetched)
            if (collector && target.mappings) {
              const errors = validateSourceItem(item.props, target.mappings);
              if (errors.length > 0) {
                for (const err of errors)
                  collector.add(target.flowId, err, item.changedAt, sourceRef.ref);
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
              collection: target.targetCollectionId,
              includeRef: target.includeRef,
            };
          }
        }
      } catch {
        log.error({ collectionId: sc.collectionId }, "Sync fetch error");
        // Skip failed source collection, continue with others
      } finally {
        // Refund unused pre-reserved quota slots
        if (reserved > consumed) {
          await addItemsCount(config.userId, -(reserved - consumed));
        }
      }
    }
  }
}

function fetchSourceCollection(
  group: SyncConfig["connectionGroups"][number],
  collectionRef: Buffer | null,
) {
  // Use a dummy collection ID — we override it per-target in the generator
  const collection = 0;

  if (group.connectionType === ConnectionType.NOTION) {
    return notionSource.fetch({
      collection,
      ref: collectionRef!,
      credentials: group.credentials?.toString("utf-8") ?? "",
    });
  }

  if (group.connectionType === ConnectionType.STRAPI) {
    return strapiSource.fetch({
      collection,
      ref: collectionRef!,
      url: group.connectionUrl!,
      credentials: group.credentials!,
    });
  }

  // Web source
  return webSource.fetch({
    collection,
    ref: collectionRef!,
    url: group.connectionUrl!,
    credentials: group.credentials ?? undefined,
  });
}

class FullSyncThrottle {
  private nextAllowedAt = new Map<number, number>();

  async wait(connectionType: ConnectionType): Promise<void> {
    const rateLimit = getRateLimitForConnectionType(connectionType);
    if (!rateLimit || rateLimit.maxRequests <= 0 || rateLimit.windowMs <= 0) {
      return;
    }

    const minIntervalMs = Math.ceil(rateLimit.windowMs / rateLimit.maxRequests);
    const now = Date.now();
    const nextAt = this.nextAllowedAt.get(connectionType) ?? now;
    const waitMs = Math.max(0, nextAt - now);
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this.nextAllowedAt.set(connectionType, Math.max(nextAt, now) + minIntervalMs);
  }
}
