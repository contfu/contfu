import { AckPolicy, RetentionPolicy } from "@nats-io/jetstream";
import { getJetStreamManager } from "../nats/jsm";
import type { WebhookFetchJob } from "./types";

const STREAM_NAME = "wh-fetch";
const SUBJECT_PREFIX = "whf";
const CONSUMER_NAME = "wh-fetch-worker";

/** 24 hours in nanoseconds (NATS max_age unit). */
const MAX_AGE_NS = 24 * 60 * 60 * 1_000_000_000;

/** Cap stream at 100k messages to bound memory; sufficient for burst webhook traffic. */
const MAX_STREAM_MSGS = 100_000;

/** Retry delivery up to 4 times before treating as a dead letter. */
export const MAX_DELIVER = 4;

/** 30 s in nanoseconds — ack timeout; long enough for a Notion API fetch + processing. */
const ACK_WAIT_NS = 30_000_000_000;

/** Publish retries on transient JetStream errors. */
const PUBLISH_RETRIES = 10;

let initialized = false;

export async function ensureWebhookFetchQueue(): Promise<void> {
  if (initialized) return;

  const jsm = await getJetStreamManager();

  try {
    await jsm.streams.add({
      name: STREAM_NAME,
      subjects: [`${SUBJECT_PREFIX}.>`],
      retention: RetentionPolicy.Workqueue,
      max_msgs: MAX_STREAM_MSGS,
      max_age: MAX_AGE_NS,
    });
  } catch {
    try {
      await jsm.streams.update(STREAM_NAME, {
        max_msgs: MAX_STREAM_MSGS,
        max_age: MAX_AGE_NS,
      });
    } catch {
      // Stream exists with matching config
    }
  }

  try {
    await jsm.consumers.add(STREAM_NAME, {
      durable_name: CONSUMER_NAME,
      ack_policy: AckPolicy.Explicit,
      filter_subject: `${SUBJECT_PREFIX}.>`,
      max_deliver: MAX_DELIVER,
      ack_wait: ACK_WAIT_NS,
    });
  } catch {
    // Consumer already exists
  }

  initialized = true;
}

export async function enqueueWebhookFetch(job: WebhookFetchJob): Promise<void> {
  await ensureWebhookFetchQueue();
  const jsm = await getJetStreamManager();
  const subject = `${SUBJECT_PREFIX}.${job.userId}.${job.connectionId}`;
  await jsm.jetstream().publish(subject, Buffer.from(JSON.stringify(job), "utf8"), {
    retries: PUBLISH_RETRIES,
  });
}

export async function* consumeWebhookFetches() {
  await ensureWebhookFetchQueue();
  const jsm = await getJetStreamManager();
  const stream = await jsm.streams.get(STREAM_NAME);
  const consumer = await stream.getConsumer(CONSUMER_NAME);

  for await (const message of await consumer.consume()) {
    yield message;
  }
}
