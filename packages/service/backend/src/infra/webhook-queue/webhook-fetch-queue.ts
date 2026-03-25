import { AckPolicy, RetentionPolicy } from "@nats-io/jetstream";
import { getJetStreamManager } from "../nats/jsm";
import type { WebhookFetchJob } from "./types";

const STREAM_NAME = "wh-fetch";
const SUBJECT_PREFIX = "whf";
const CONSUMER_NAME = "wh-fetch-worker";

/** 24 hours in nanoseconds (NATS max_age unit). */
const MAX_AGE_NS = 24 * 60 * 60 * 1_000_000_000;

let initialized = false;

export async function ensureWebhookFetchQueue(): Promise<void> {
  if (initialized) return;

  const jsm = await getJetStreamManager();

  try {
    await jsm.streams.add({
      name: STREAM_NAME,
      subjects: [`${SUBJECT_PREFIX}.>`],
      retention: RetentionPolicy.Workqueue,
      max_msgs: 100_000,
      max_age: MAX_AGE_NS,
    });
  } catch {
    try {
      await jsm.streams.update(STREAM_NAME, {
        max_msgs: 100_000,
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
      max_deliver: 4,
      ack_wait: 30_000_000_000,
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
    retries: 10,
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
