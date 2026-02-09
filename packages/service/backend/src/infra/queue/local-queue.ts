import type { Job, Queue } from "./queue";

/**
 * Local in-memory queue for development and testing.
 * Jobs are processed immediately in sequence.
 */

const jobQueue: Job[] = [];
let handler: ((job: Job) => Promise<void>) | null = null;
let processing = false;

async function processQueue() {
  if (processing || !handler) return;
  processing = true;

  while (jobQueue.length > 0) {
    const job = jobQueue.shift();
    if (job) {
      try {
        await handler(job);
      } catch (error) {
        console.error("Local queue job error:", error);
      }
    }
  }

  processing = false;
}

export function push(job: Job): void {
  jobQueue.push(job);
  // Process asynchronously
  setTimeout(() => processQueue(), 0);
}

export function handle(h: (job: Job) => Promise<void>): void {
  handler = h;
  // Start processing any queued jobs
  if (jobQueue.length > 0) {
    setTimeout(() => processQueue(), 0);
  }
}

export async function* isScheduler(): AsyncGenerator<boolean> {
  // In local mode, we're always the scheduler
  yield true;
}

export const q: Queue = {
  push,
  handle,
  isScheduler,
};
