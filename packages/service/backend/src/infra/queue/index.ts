import type { Queue } from "./queue";
import { q } from "./nats-queue";

export type { Job, JobType, Queue } from "./queue";

export function getQueue(): Promise<Queue> {
  return Promise.resolve(q);
}
