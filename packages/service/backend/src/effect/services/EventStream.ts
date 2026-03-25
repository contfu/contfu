import { Effect, Layer, ServiceMap } from "effect";
import type { StoredWireItemEvent } from "../../infra/nats/event-stream";
import { NatsError } from "../errors";

export class EventStream extends ServiceMap.Service<
  EventStream,
  {
    readonly ensureStream: Effect.Effect<void, NatsError>;
    readonly publishEvent: (
      userId: number,
      collectionId: number,
      event: StoredWireItemEvent,
    ) => Effect.Effect<number, NatsError>;
    readonly getLastSequence: Effect.Effect<number, NatsError>;
    readonly isSequenceAvailable: (seq: number) => Effect.Effect<boolean, NatsError>;
    readonly replayEvents: (opts: {
      fromSeq: number;
      userId: number;
      collectionIds: number[];
    }) => AsyncGenerator<{ seq: number; collectionId: number; event: StoredWireItemEvent }>;
  }
>()("@contfu/EventStream") {}

/**
 * Production layer — wraps the existing event-stream module.
 */
export const EventStreamLive = Layer.effect(EventStream)(
  Effect.gen(function* () {
    const mod = yield* Effect.tryPromise({
      try: () => import("../../infra/nats/event-stream"),
      catch: (e) => new NatsError({ cause: e }),
    });

    return {
      ensureStream: Effect.tryPromise({
        try: () => mod.ensureEventStream(),
        catch: (e) => new NatsError({ cause: e }),
      }),

      publishEvent: (userId: number, collectionId: number, event: StoredWireItemEvent) =>
        Effect.tryPromise({
          try: () => mod.publishEvent(userId, collectionId, event),
          catch: (e) => new NatsError({ cause: e }),
        }).pipe(Effect.withSpan("nats.publishEvent", { attributes: { userId, collectionId } })),

      getLastSequence: Effect.tryPromise({
        try: () => mod.getLastSequence(),
        catch: (e) => new NatsError({ cause: e }),
      }),

      isSequenceAvailable: (seq: number) =>
        Effect.tryPromise({
          try: () => mod.isSequenceAvailable(seq),
          catch: (e) => new NatsError({ cause: e }),
        }),

      replayEvents: mod.replayEvents,
    };
  }),
);
