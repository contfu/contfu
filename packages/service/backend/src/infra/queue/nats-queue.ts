import { AckPolicy, RetentionPolicy, type ConsumerCallbackFn } from "@nats-io/jetstream";
import { getJetStreamManager } from "../nats/jsm";
import { raceForLeader } from "../nats/leader-election";
import type { Job, Queue } from "./queue";

const STREAM_NAME = "sync-jobs";
const CONSUMER_NAME = "sync-worker";
const SCHEDULER_KEY = "scheduler";

let initialized = false;

async function ensureStream() {
  if (initialized) return;

  const jsm = await getJetStreamManager();

  // Create stream for sync jobs
  try {
    await jsm.streams.add({
      name: STREAM_NAME,
      subjects: ["job.*"],
      retention: RetentionPolicy.Workqueue,
      max_msgs: 100_000,
      max_age: 1_000 * 60 * 60 * 24, // 24h max age
    });
  } catch {
    // Stream may already exist
    await jsm.streams.get(STREAM_NAME);
  }

  // Create durable consumer
  try {
    await jsm.consumers.add(STREAM_NAME, {
      durable_name: CONSUMER_NAME,
      ack_policy: AckPolicy.Explicit,
      filter_subject: "job.*",
      max_deliver: 3, // Max redelivery attempts
    });
  } catch {
    // Consumer may already exist
  }

  initialized = true;
}

export async function push(job: Job): Promise<void> {
  await ensureStream();
  const jsm = await getJetStreamManager();

  const payload = Buffer.from(JSON.stringify(job));
  await jsm.jetstream().publish(`job.${job.type}`, payload, { retries: 10 });
}

export async function handle(handler: (job: Job) => Promise<void>): Promise<void> {
  await ensureStream();
  const jsm = await getJetStreamManager();

  const stream = await jsm.streams.get(STREAM_NAME);
  const consumer = await stream.getConsumer(CONSUMER_NAME);

  consumer.consume({
    callback: (async (message) => {
      try {
        const job = JSON.parse(Buffer.from(message.data).toString("utf8")) as Job;
        await handler(job);
        message.ack();
      } catch (error) {
        console.error("Job processing error:", error);
        if (message.redelivered) {
          // Failed after retry, terminate
          message.term();
        } else {
          // Retry after 1 second
          message.nak(1000);
        }
      }
    }) as ConsumerCallbackFn,
    max_messages: 10,
  });
}

export async function* isScheduler(): AsyncGenerator<boolean> {
  yield* raceForLeader(SCHEDULER_KEY);
}

export const q: Queue = {
  push: (job) => {
    void push(job).catch((err) => {
      console.error("Job publish error:", err);
    });
  },
  handle,
  isScheduler,
};
