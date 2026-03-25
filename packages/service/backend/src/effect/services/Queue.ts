import { Effect, Layer, ServiceMap } from "effect";
import type { Job, Queue as QueueInterface } from "../../infra/queue/queue";

export class Queue extends ServiceMap.Service<
  Queue,
  {
    readonly push: (job: Job) => Effect.Effect<void>;
    readonly consume: () => AsyncGenerator<Job>;
    readonly isScheduler: () => AsyncGenerator<boolean>;
  }
>()("@contfu/Queue") {}

/**
 * Production layer — wraps the existing queue module (NATS or local fallback).
 */
export const QueueLive = Layer.effect(Queue)(
  Effect.gen(function* () {
    const mod = yield* Effect.tryPromise({
      try: () => import("../../infra/queue/index"),
      catch: (e) => new Error(`Failed to load queue module: ${String(e)}`),
    });

    const queue: QueueInterface = yield* Effect.tryPromise({
      try: () => mod.getQueue(),
      catch: (e) => new Error(`Failed to get queue: ${String(e)}`),
    });

    return {
      push: (job: Job) =>
        Effect.sync(() => queue.push(job)).pipe(
          Effect.withSpan("queue.push", { attributes: { jobType: job.type } }),
        ),
      consume: () => queue.consume(),
      isScheduler: () => queue.isScheduler(),
    };
  }),
);
