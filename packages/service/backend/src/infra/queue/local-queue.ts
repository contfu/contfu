import type { Job, JobMessage, Queue } from "./queue";

/**
 * Local in-memory queue for development and testing.
 * Jobs are processed via async generator pattern.
 */

const jobQueue: Job[] = [];
let resolveNext: ((job: Job) => void) | null = null;

function push(job: Job): void {
  if (resolveNext) {
    // Consumer is waiting, deliver immediately
    const resolve = resolveNext;
    resolveNext = null;
    resolve(job);
  } else {
    // Queue for later consumption
    jobQueue.push(job);
  }
}

async function* consume(): AsyncGenerator<JobMessage> {
  while (true) {
    // Get next job from queue or wait for one
    const job = await new Promise<Job>((resolve) => {
      const queued = jobQueue.shift();
      if (queued) {
        resolve(queued);
      } else {
        resolveNext = resolve;
      }
    });

    yield {
      job,
      ack: () => {}, // No-op in local mode
      nack: () => {
        // Re-queue on failure
        jobQueue.unshift(job);
      },
    };
  }
}

async function* isScheduler(): AsyncGenerator<boolean> {
  // In local mode, we're always the scheduler
  yield true;
}

export const q: Queue = {
  push,
  consume,
  isScheduler,
};
