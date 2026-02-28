import type { Job, Queue } from "./queue";

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

async function* consume(): AsyncGenerator<Job> {
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

    let acked = false;
    try {
      yield job;
      // Resumed via .next() = success
      acked = true;
    } finally {
      if (!acked) {
        // Resumed via .return()/.throw() = failure, re-queue
        jobQueue.unshift(job);
      }
    }
  }
}

// eslint-disable-next-line typescript/require-await -- async generator required by AsyncGenerator return type
async function* isScheduler(): AsyncGenerator<boolean> {
  // In local mode, we're always the scheduler
  yield true;
}

export const q: Queue = {
  push,
  consume,
  isScheduler,
};
