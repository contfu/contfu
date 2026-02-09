import { hasNats } from "../nats/connection";
import type { Queue } from "./queue";

export type { Queue, Job, JobType } from "./queue";

let _queue: Queue | null = null;

export async function getQueue(): Promise<Queue> {
  if (_queue) return _queue;

  if (hasNats()) {
    const { q } = await import("./nats-queue");
    _queue = q;
  } else {
    const { q } = await import("./local-queue");
    _queue = q;
  }

  return _queue;
}
