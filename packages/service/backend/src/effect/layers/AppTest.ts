import { Effect, Layer, Option } from "effect";
import { LoggerLive } from "../../infra/logger";
import { DatabaseLive } from "../services/Database";
import { NatsClient } from "../services/NatsClient";
import { EventStream } from "../services/EventStream";
import { CryptoLive } from "../services/Crypto";
import { Mail } from "../services/Mail";
import { Queue } from "../services/Queue";
import { StreamServerLive } from "../services/StreamServer";

/**
 * No-op NATS client for tests.
 */
const NatsClientTest = Layer.succeed(NatsClient, {
  connection: Option.none(),
  hasNats: false,
});

/**
 * No-op EventStream for tests.
 */
const EventStreamTest = Layer.succeed(EventStream, {
  ensureStream: Effect.void,
  publishEvent: () => Effect.succeed(0),
  getLastSequence: Effect.succeed(0),
  isSequenceAvailable: () => Effect.succeed(false),
  replayEvents: async function* () {},
});

/**
 * No-op Mail for tests.
 */
const MailTest = Layer.succeed(Mail, {
  sendEmail: () => Effect.void,
});

/**
 * No-op Queue for tests.
 */
const QueueTest = Layer.succeed(Queue, {
  push: () => Effect.void,
  consume: async function* () {},
  isScheduler: async function* () {
    yield true;
  },
});

/**
 * Test layer — uses PGlite (via TEST_MODE env), no-op NATS/Mail/Queue.
 */
export const AppTest = Layer.mergeAll(
  DatabaseLive,
  NatsClientTest,
  EventStreamTest,
  CryptoLive,
  MailTest,
  QueueTest,
  StreamServerLive,
  LoggerLive,
);
