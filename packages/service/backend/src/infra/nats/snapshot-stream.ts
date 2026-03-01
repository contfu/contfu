import { DeliverPolicy, RetentionPolicy } from "@nats-io/jetstream";
import { pack, unpack } from "msgpackr";
import { createLogger } from "../logger/index";
import { hasNats } from "./connection";
import { getJetStreamManager } from "./jsm";
import { getKvManager } from "./kvm";
import type { StoredWireItemEvent } from "./event-stream";
import type { KV } from "@nats-io/kv";

const log = createLogger("nats-snapshots");

const STREAM_NAME = "snapshots";
const SUBJECT_PREFIX = "snap";

/** 1 hour in nanoseconds (NATS max_age unit). */
const MAX_AGE_NS = 1 * 60 * 60 * 1_000_000_000;

/** 1 hour in milliseconds (KV TTL unit). */
const KV_TTL_MS = 1 * 60 * 60 * 1000;

const PROGRESS_BUCKET = "snapshot-progress";

type SnapshotProgress = {
  inProgress: boolean;
  lastAckedSeq: number;
  eventsStartSeq: number;
};

let initialized = false;

/**
 * Ensure the JetStream snapshot stream exists.
 * Creates or updates the stream on startup.
 */
export async function ensureSnapshotStream(): Promise<void> {
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
}

/**
 * Publish a snapshot item to the JetStream snapshot stream.
 * Returns the JetStream sequence number, or 0 if NATS is unavailable.
 */
export async function publishSnapshot(
  userId: number,
  consumerId: number,
  event: StoredWireItemEvent,
): Promise<number> {
  if (!hasNats()) return 0;

  const jsm = await getJetStreamManager();
  const subject = `${SUBJECT_PREFIX}.${userId}.${consumerId}`;
  const ack = await jsm.jetstream().publish(subject, pack(event));
  return ack.seq;
}

/**
 * Check if a given sequence number is still available in the snapshot stream
 * for a specific consumer.
 */
export async function isSnapshotSeqAvailable(
  userId: number,
  consumerId: number,
  seq: number,
): Promise<boolean> {
  if (!hasNats()) return false;

  const jsm = await getJetStreamManager();
  try {
    const info = await jsm.streams.info(STREAM_NAME);
    if (info.state.messages === 0) return seq >= info.state.last_seq;
    return seq >= info.state.first_seq;
  } catch {
    return false;
  }
}

/**
 * Replay snapshot items from the snapshot stream starting at a given sequence.
 * Yields events filtered to the specified consumer's subject.
 */
export async function* replaySnapshotFrom(
  userId: number,
  consumerId: number,
  fromSeq: number,
): AsyncGenerator<{ seq: number; event: StoredWireItemEvent }> {
  if (!hasNats()) return;

  const jsm = await getJetStreamManager();
  const stream = await jsm.streams.get(STREAM_NAME);

  const filterSubject = `${SUBJECT_PREFIX}.${userId}.${consumerId}`;

  const consumer = await stream.getConsumer({
    opt_start_seq: fromSeq,
    deliver_policy: DeliverPolicy.StartSequence,
    filter_subjects: [filterSubject],
  });

  const messages = await consumer.fetch({ max_messages: 10_000 });
  for await (const msg of messages) {
    try {
      const event = unpack(msg.data) as StoredWireItemEvent;
      yield { seq: msg.seq, event };
    } catch (error) {
      log.error({ err: error }, "Error parsing snapshot event during replay");
    }
  }
}

/**
 * Purge all snapshot messages for a specific consumer.
 */
export async function purgeConsumerSnapshot(userId: number, consumerId: number): Promise<void> {
  if (!hasNats()) return;

  const jsm = await getJetStreamManager();
  const filterSubject = `${SUBJECT_PREFIX}.${userId}.${consumerId}`;
  await jsm.streams.purge(STREAM_NAME, { filter: filterSubject });
}

// --- KV helpers for snapshot progress tracking ---

let progressKv: Promise<KV> | null = null;

async function getProgressKv(): Promise<KV> {
  return (progressKv ??= getKvManager().then((kvm) =>
    kvm.create(PROGRESS_BUCKET, { ttl: KV_TTL_MS }),
  ));
}

function progressKey(userId: number, consumerId: number): string {
  return `${userId}_${consumerId}`;
}

/**
 * Record that a snapshot is in progress for a consumer.
 * Stores the events stream sequence at which the snapshot started,
 * so replay can resume from the right point after snapshot completes.
 */
export async function setSnapshotProgress(
  userId: number,
  consumerId: number,
  eventsStartSeq: number,
): Promise<void> {
  const kv = await getProgressKv();
  const key = progressKey(userId, consumerId);
  const value: SnapshotProgress = {
    inProgress: true,
    lastAckedSeq: 0,
    eventsStartSeq,
  };
  await kv.put(key, pack(value));
}

/**
 * Get the snapshot progress for a consumer, or null if none exists.
 */
export async function getSnapshotProgress(
  userId: number,
  consumerId: number,
): Promise<SnapshotProgress | null> {
  const kv = await getProgressKv();
  const key = progressKey(userId, consumerId);
  const entry = (await kv.get(key)) as { value: Uint8Array } | null;
  if (!entry) return null;
  try {
    return unpack(entry.value) as SnapshotProgress;
  } catch {
    return null;
  }
}

/**
 * Update the last-acked snapshot sequence for a consumer.
 */
export async function updateSnapshotAckedSeq(
  userId: number,
  consumerId: number,
  seq: number,
): Promise<void> {
  const kv = await getProgressKv();
  const key = progressKey(userId, consumerId);
  const entry = (await kv.get(key)) as { value: Uint8Array; revision: number } | null;
  if (!entry) return;
  try {
    const state = unpack(entry.value) as SnapshotProgress;
    state.lastAckedSeq = seq;
    await kv.update(key, pack(state), entry.revision);
  } catch {
    // CAS conflict or parse error — best-effort
  }
}

/**
 * Clear snapshot progress for a consumer.
 */
export async function clearSnapshotProgress(userId: number, consumerId: number): Promise<void> {
  const kv = await getProgressKv();
  const key = progressKey(userId, consumerId);
  try {
    await kv.delete(key);
  } catch {
    // Key may not exist
  }
}
