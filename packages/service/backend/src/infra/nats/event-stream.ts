import { EventType, type WireItem } from "@contfu/core";
import { DeliverPolicy, RetentionPolicy } from "@nats-io/jetstream";
import { pack, unpack } from "msgpackr";
import { createLogger } from "../logger/index";
import { hasNats } from "./connection";
import { getJetStreamManager } from "./jsm";
import { ensureSnapshotStream } from "./snapshot-stream";

const log = createLogger("nats-events");

const STREAM_NAME = "events";
const SUBJECT_PREFIX = "evt";

/** 3 days in nanoseconds (NATS max_age unit). */
const MAX_AGE_NS = 3 * 24 * 60 * 60 * 1_000_000_000;

export type StoredWireItemEvent =
  | [typeof EventType.ITEM_CHANGED, WireItem]
  | [typeof EventType.ITEM_DELETED, Uint8Array];

let initialized = false;

/**
 * Ensure the JetStream event stream exists.
 * Creates or updates the stream on startup.
 */
export async function ensureEventStream(): Promise<void> {
  if (initialized || !hasNats()) return;

  const jsm = await getJetStreamManager();

  try {
    await jsm.streams.add({
      name: STREAM_NAME,
      subjects: [`${SUBJECT_PREFIX}.>`],
      retention: RetentionPolicy.Limits,
      max_age: MAX_AGE_NS,
    });
  } catch {
    // Stream may already exist — update it
    try {
      await jsm.streams.update(STREAM_NAME, {
        max_age: MAX_AGE_NS,
      });
    } catch {
      // Already exists with same config
    }
  }

  initialized = true;

  await ensureSnapshotStream();
}

/**
 * Publish an item event to the JetStream event stream.
 * Returns the JetStream sequence number, or 0 if NATS is unavailable.
 */
export async function publishEvent(
  userId: number,
  collectionId: number,
  event: StoredWireItemEvent,
): Promise<number> {
  if (!hasNats()) return 0;

  const jsm = await getJetStreamManager();
  const subject = `${SUBJECT_PREFIX}.${userId}.${collectionId}`;
  const ack = await jsm.jetstream().publish(subject, pack(event));
  return ack.seq;
}

/**
 * Get the last sequence number from the event stream.
 * Returns 0 if NATS is unavailable or stream is empty.
 */
export async function getLastSequence(): Promise<number> {
  if (!hasNats()) return 0;

  const jsm = await getJetStreamManager();
  try {
    const info = await jsm.streams.info(STREAM_NAME);
    return info.state.last_seq;
  } catch {
    return 0;
  }
}

/**
 * Check if a given sequence number is still available in the stream.
 * Returns false if NATS is unavailable.
 */
export async function isSequenceAvailable(seq: number): Promise<boolean> {
  if (!hasNats()) return false;

  const jsm = await getJetStreamManager();
  try {
    const info = await jsm.streams.info(STREAM_NAME);
    // seq is available if it's >= first_seq (or stream is empty and seq is 0)
    if (info.state.messages === 0) return seq >= info.state.last_seq;
    return seq >= info.state.first_seq;
  } catch {
    return false;
  }
}

/**
 * Purge events from the stream up to (but not including) the given sequence number.
 * No-op if NATS is unavailable.
 */
export async function purgeEventsUpTo(seq: number): Promise<void> {
  if (!hasNats()) return;

  const jsm = await getJetStreamManager();
  await jsm.streams.purge(STREAM_NAME, { seq });
}

/**
 * Replay events from the stream starting at a given sequence number.
 * Yields events filtered to the specified user's collection subjects.
 * Yields until caught up, then returns.
 */
export async function* replayEvents(opts: {
  fromSeq: number;
  userId: number;
  collectionIds: number[];
}): AsyncGenerator<{ seq: number; collectionId: number; event: StoredWireItemEvent }> {
  if (!hasNats() || opts.collectionIds.length === 0) return;

  const jsm = await getJetStreamManager();
  const stream = await jsm.streams.get(STREAM_NAME);

  const filterSubjects = opts.collectionIds.map((cid) => `${SUBJECT_PREFIX}.${opts.userId}.${cid}`);

  const consumer = await stream.getConsumer({
    opt_start_seq: opts.fromSeq,
    deliver_policy: DeliverPolicy.StartSequence,
    filter_subjects: filterSubjects,
  });

  const messages = await consumer.fetch({ max_messages: 10_000 });
  for await (const msg of messages) {
    try {
      const event = unpack(msg.data) as StoredWireItemEvent;
      const parts = msg.subject.split(".");
      const collectionId = Number(parts[2] ?? "0");
      yield { seq: msg.seq, collectionId, event };
    } catch (error) {
      log.error({ err: error }, "Error parsing event during replay");
    }
  }
}
