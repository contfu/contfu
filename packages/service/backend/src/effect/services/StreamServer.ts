import { Effect, Layer, ServiceMap } from "effect";
import { StreamServer as StreamServerClass } from "../../infra/stream/stream-server";

export class StreamServerService extends ServiceMap.Service<
  StreamServerService,
  StreamServerClass
>()("@contfu/StreamServer") {}

/**
 * Production layer — creates a StreamServer instance with acquire/release lifecycle.
 */
export const StreamServerLive = Layer.effect(StreamServerService)(
  Effect.sync(() => new StreamServerClass()),
);
