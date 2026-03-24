import { Layer } from "effect";
import { LoggerLive } from "../../infra/logger";
import { TelemetryLive } from "../telemetry";
import { DatabaseLive } from "../services/Database";
import { NatsClientLive } from "../services/NatsClient";
import { EventStreamLive } from "../services/EventStream";
import { CryptoLive } from "../services/Crypto";
import { MailLive } from "../services/Mail";
import { QueueLive } from "../services/Queue";

/**
 * Infrastructure layer — all infra services without lifecycle (StreamServer, SyncWorkerManager).
 * Used as a base for both app and worker runtimes.
 */
const InfraLive = Layer.mergeAll(DatabaseLive, NatsClientLive, CryptoLive, MailLive);

/**
 * EventStream depends on NatsClient, so it must be provided separately.
 */
const EventStreamWithDeps = EventStreamLive.pipe(Layer.provide(NatsClientLive));

/**
 * Queue depends on NATS availability (resolved internally).
 */
const QueueWithDeps = QueueLive;

/**
 * Production layer for the SvelteKit app runtime.
 * Provides infrastructure services needed by Effect-based features.
 * StreamServer and SyncWorkerManager are excluded — they have their own
 * lifecycle managed by startup.ts (initialize/shutdown) and must not be
 * duplicated inside the Effect runtime.
 */
export const AppLive = Layer.mergeAll(
  InfraLive,
  EventStreamWithDeps,
  QueueWithDeps,
  TelemetryLive,
  LoggerLive,
);
