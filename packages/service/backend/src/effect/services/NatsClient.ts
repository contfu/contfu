import { Effect, Layer, Option, ServiceMap } from "effect";
import type { NatsConnection } from "@nats-io/transport-node";
import { NatsError } from "../errors";

export class NatsClient extends ServiceMap.Service<
  NatsClient,
  {
    readonly connection: Option.Option<NatsConnection>;
    readonly hasNats: boolean;
  }
>()("@contfu/NatsClient") {}

/**
 * Production layer — connects to NATS if NATS_SERVER is configured, otherwise provides a no-op.
 */
export const NatsClientLive = Layer.effect(NatsClient)(
  Effect.gen(function* () {
    const mod = yield* Effect.tryPromise({
      try: () => import("../../infra/nats/connection"),
      catch: (e) => new NatsError({ cause: e }),
    });

    if (!mod.hasNats()) {
      return { connection: Option.none(), hasNats: false };
    }

    const nc = yield* Effect.tryPromise({
      try: () => mod.getNatsConnection(),
      catch: (e) => new NatsError({ cause: e }),
    });

    return { connection: Option.some(nc), hasNats: true };
  }),
);
