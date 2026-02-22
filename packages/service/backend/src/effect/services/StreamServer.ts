import { Context, Effect, Layer } from "effect";
import { StreamServer as StreamServerClass } from "../../infra/stream/stream-server";

export class StreamServerService extends Context.Tag("@contfu/StreamServer")<
  StreamServerService,
  StreamServerClass
>() {}

/**
 * Production layer — creates a StreamServer instance with acquire/release lifecycle.
 */
export const StreamServerLive = Layer.effect(
  StreamServerService,
  Effect.sync(() => new StreamServerClass()),
);
