import { Layer } from "effect";
import { LoggerLive } from "../../infra/logger";
import { TelemetryLive } from "../telemetry";
import { DatabaseLive } from "../services/Database";
import { NatsClientLive } from "../services/NatsClient";
import { EventStreamLive } from "../services/EventStream";
import { CryptoLive } from "../services/Crypto";
import { MailLive } from "../services/Mail";
import { QueueLive } from "../services/Queue";
import { StreamServerLive } from "../services/StreamServer";
import { SyncWorkerManagerLive } from "../services/SyncWorkerManager";

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
 * Full production layer for the SvelteKit app runtime.
 * Includes all services, lifecycle management, and telemetry.
 */
export const AppLive = Layer.mergeAll(
  InfraLive,
  EventStreamWithDeps,
  QueueWithDeps,
  StreamServerLive,
  SyncWorkerManagerLive,
  TelemetryLive,
  LoggerLive,
);
