import { AckPolicy, DeliverPolicy } from "@nats-io/jetstream";
import { Effect } from "effect";
import { hasNats } from "./connection";
import { getJetStreamManager } from "./jsm";

const STREAM_NAME = "events";

/**
 * Durable consumer name for a service connection + collection pair.
 */
export function pushConsumerName(connectionId: number, collectionId: number): string {
  return `svc-${connectionId}-${collectionId}`;
}

/**
 * Create or bind to an existing durable NATS consumer for a service connection + collection pair.
 * No-op if NATS is unavailable.
 */
export function setupPushConsumer(
  userId: number,
  connectionId: number,
  collectionId: number,
): Effect.Effect<void, void> {
  if (!hasNats()) return Effect.void;

  const name = pushConsumerName(connectionId, collectionId);
  const filterSubject = `evt.${userId}.${collectionId}`;

  return Effect.tryPromise({
    try: () =>
      getJetStreamManager().then((jsm) =>
        jsm.consumers.add(STREAM_NAME, {
          durable_name: name,
          filter_subject: filterSubject,
          deliver_policy: DeliverPolicy.All,
          ack_policy: AckPolicy.Explicit,
        }),
      ),
    catch: (e) => {
      if (e instanceof Error && e.message.includes("already exists")) return;
      throw e;
    },
  }).pipe(Effect.asVoid);
}

/**
 * Delete the durable NATS consumer for a service connection + collection pair.
 * No-op if NATS is unavailable or consumer doesn't exist.
 */
export function teardownPushConsumer(
  connectionId: number,
  collectionId: number,
): Effect.Effect<void, void> {
  if (!hasNats()) return Effect.void;

  const name = pushConsumerName(connectionId, collectionId);

  return Effect.tryPromise({
    try: () => getJetStreamManager().then((jsm) => jsm.consumers.delete(STREAM_NAME, name)),
    catch: (e) => {
      if (e instanceof Error && e.message.includes("not found")) return;
      throw e;
    },
  }).pipe(Effect.asVoid);
}
