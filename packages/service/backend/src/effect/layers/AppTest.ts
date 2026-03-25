import { Effect, Layer } from "effect";
import { LoggerLive } from "../../infra/logger";
import { DatabaseLive } from "../services/Database";
import { EventStream } from "../services/EventStream";
import { CryptoLive } from "../services/Crypto";
import { Mail } from "../services/Mail";
import { Queue } from "../services/Queue";
import { StreamServerLive } from "../services/StreamServer";

/**
 * No-op EventStream for tests.
 */
const EventStreamTest = Layer.succeed(EventStream)({
  ensureStream: Effect.void,
  publishEvent: () => Effect.succeed(0),
  getLastSequence: Effect.succeed(0),
  isSequenceAvailable: () => Effect.succeed(false),
  replayEvents: async function* () {},
});

/**
 * No-op Mail for tests.
 */
const MailTest = Layer.succeed(Mail)({
  sendEmail: () => Effect.void,
});

/**
 * No-op Queue for tests.
 */
const QueueTest = Layer.succeed(Queue)({
  push: () => Effect.void,
  consume: async function* () {},
  // eslint-disable-next-line typescript/require-await -- async generator required by AsyncGenerator return type
  isScheduler: async function* () {
    yield true;
  },
});

/**
 * Test layer — uses PGlite (via NODE_ENV=test env), no-op NATS/Mail/Queue.
 */
export const AppTest = Layer.mergeAll(
  DatabaseLive,
  EventStreamTest,
  CryptoLive,
  MailTest,
  QueueTest,
  StreamServerLive,
  LoggerLive,
);
