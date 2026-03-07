import { createLogger } from "../../infra/logger/index";
import { hasNats } from "../../infra/nats/connection";
import { getLastSequence } from "../../infra/nats/event-stream";
import {
  clearSnapshotProgress,
  getSnapshotProgress,
  publishSnapshot,
  purgeConsumerSnapshot,
  setSnapshotProgress,
} from "../../infra/nats/snapshot-stream";
import { getCollectionNamesByIds, toWireItem } from "../../infra/stream/stream-server";
import { runEffectWithServices } from "../../effect/run";
import { getConsumerSyncConfig, type ConsumerSyncConfig } from "../sync/getConsumerSyncConfig";
import { fetchAndStreamItems } from "../sync/fetchAndStreamItems";
import { EventType } from "@contfu/core";
import type { StoredWireItemEvent } from "../../infra/nats/event-stream";

const log = createLogger("trigger-snapshot");

export async function triggerConsumerSnapshot(userId: number, consumerId: number, collectionId: number): Promise<void> {
  if (!hasNats()) return;

  try {
    const existing = await getSnapshotProgress(userId, consumerId);
    if (existing?.inProgress) return;

    const eventsStartSeq = await getLastSequence();
    await setSnapshotProgress(userId, consumerId, eventsStartSeq);

    const config = await runEffectWithServices(getConsumerSyncConfig(userId, consumerId, [collectionId])) as ConsumerSyncConfig;
    const collectionNames = await getCollectionNamesByIds(config.collectionIds, userId);

    for await (const item of fetchAndStreamItems(config)) {
      const wireEvent: StoredWireItemEvent = [
        EventType.ITEM_CHANGED,
        toWireItem(
          item,
          collectionNames.get(item.collection) ?? String(item.collection),
          item.includeRef,
        ),
      ];
      await publishSnapshot(userId, consumerId, wireEvent);
    }

    await purgeConsumerSnapshot(userId, consumerId);
    await clearSnapshotProgress(userId, consumerId);
    log.info({ userId, consumerId }, "Background snapshot complete");
  } catch (err) {
    log.error({ err, userId, consumerId }, "Background snapshot failed");
  }
}
