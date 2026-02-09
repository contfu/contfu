import { hasNats } from "../nats/connection";
import type { Queue } from "./queue";

export type { Job, JobType, Queue } from "./queue";

let _queue: Promise<Queue> | null = null;

export async function getQueue(): Promise<Queue> {
  return (_queue ??= import(hasNats() ? "./nats-queue" : "./local-queue").then((m) => m.q));
}
