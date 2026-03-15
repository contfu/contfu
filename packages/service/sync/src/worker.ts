/// <reference lib="webworker" />
declare const self: Worker;

import { ConnectionType } from "@contfu/core";
import { createLogger, LoggerLive } from "@contfu/svc-backend/infra/logger/index";
import { claimJobs } from "@contfu/svc-backend/features/sync-jobs/claimJobs";
import { completeJob } from "@contfu/svc-backend/features/sync-jobs/completeJob";
import {
  failJob,
  failJobPermanently,
} from "@contfu/svc-backend/features/sync-jobs/failJob";
import { getJobConfig } from "@contfu/svc-backend/features/sync-jobs/getJobConfig";
import { CryptoError } from "@contfu/svc-backend/effect/errors/index";
import { Database } from "@contfu/svc-backend/effect/services/Database";
import { SyncMessageType, type UserSyncItem } from "@contfu/svc-backend/infra/sync-worker/messages";
import {
  getItemRefForSource,
  notionSource,
  strapiSource,
  webSource,
  contentfulSource,
} from "@contfu/svc-sources";
import { Duration, Effect, Layer, Schedule } from "effect";
import { workerDb } from "./db/worker-db";

const log = createLogger("sync-worker");

// Constants
const MAX_COLLECTION_PULL_SIZE = Number(process.env.MAX_COLLECTION_PULL_SIZE ?? 10_000);
const MIN_FETCH_INTERVAL = Number(process.env.MIN_FETCH_INTERVAL ?? 10_000);

// Worker identity
const workerId = crypto.randomUUID();

function isCryptoFailure(error: unknown): error is CryptoError {
  return (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    error._tag === "CryptoError"
  );
}

function getJobFailureMessage(error: unknown): string {
  if (isCryptoFailure(error)) {
    return "Credentials could not be decrypted. Verify BETTER_AUTH_SECRET or reconnect the source.";
  }

  return String(error);
}

// Database layer for the sync worker — uses workerDb directly, no RLS
const WorkerDbLayer = Layer.succeed(Database)({
  db: workerDb,
  withUserContext: (_userId, effect) => effect,
});

// Handle messages from the app
self.onmessage = (e: MessageEvent) => {
  if (e.data.type === SyncMessageType.SHUTDOWN) {
    process.exit(0);
  }
};

// Job processing as an Effect
const processJob = (job: { id: number; collectionId: number }) =>
  Effect.gen(function* () {
    const config = yield* getJobConfig({ collectionId: job.collectionId });
    if (!config) {
      yield* Effect.logWarning("Collection config not found").pipe(
        Effect.annotateLogs({
          module: "sync-worker",
          jobId: job.id,
          collectionId: job.collectionId,
        }),
      );
      yield* failJob(job.id, "Collection config not found");
      return;
    }

    yield* Effect.logDebug("Fetching collection").pipe(
      Effect.annotateLogs({
        module: "sync-worker",
        jobId: job.id,
        collectionId: job.collectionId,
        sourceType: config.sourceType,
      }),
    );

    const userId = config.userId;
    const fetchedItems: UserSyncItem[] = [];

    // Dispatch to appropriate source adapter
    yield* Effect.tryPromise({
      try: async () => {
        if (config.sourceType === ConnectionType.NOTION) {
          for await (const item of notionSource.fetch({
            collection: config.collectionId,
            ref: config.collectionRef!,
            credentials: config.credentials?.toString("utf-8") ?? "",
          })) {
            const sourceRef = getItemRefForSource({
              sourceType: config.sourceType,
              rawRef: item.ref,
              sourceUrl: config.sourceUrl,
              collectionRef: config.collectionRef,
            });
            fetchedItems.push({
              ...item,
              user: userId,
              sourceType: sourceRef.sourceType,
              ref: sourceRef.ref,
            });
          }
        } else if (config.sourceType === ConnectionType.STRAPI) {
          for await (const item of strapiSource.fetch({
            collection: config.collectionId,
            ref: config.collectionRef!,
            url: config.sourceUrl!,
            credentials: config.credentials!,
          })) {
            const sourceRef = getItemRefForSource({
              sourceType: config.sourceType,
              rawRef: item.ref,
              sourceUrl: config.sourceUrl,
              collectionRef: config.collectionRef,
            });
            fetchedItems.push({
              ...item,
              user: userId,
              sourceType: sourceRef.sourceType,
              ref: sourceRef.ref,
            });
          }
        } else if (config.sourceType === ConnectionType.CONTENTFUL) {
          for await (const item of contentfulSource.fetch({
            collection: config.collectionId,
            ref: config.collectionRef!,
            spaceId: config.sourceUrl!,
            credentials: config.credentials!,
          })) {
            const sourceRef = getItemRefForSource({
              sourceType: config.sourceType,
              rawRef: item.ref,
              sourceUrl: config.sourceUrl,
              collectionRef: config.collectionRef,
            });
            fetchedItems.push({
              ...item,
              user: userId,
              sourceType: sourceRef.sourceType,
              ref: sourceRef.ref,
            });
          }
        } else {
          for await (const item of webSource.fetch({
            collection: config.collectionId,
            ref: config.collectionRef!,
            url: config.sourceUrl!,
            credentials: config.credentials ?? undefined,
          })) {
            const sourceRef = getItemRefForSource({
              sourceType: config.sourceType,
              rawRef: item.ref,
              sourceUrl: config.sourceUrl,
              collectionRef: config.collectionRef,
            });
            fetchedItems.push({
              ...item,
              user: userId,
              sourceType: sourceRef.sourceType,
              ref: sourceRef.ref,
            });
          }
        }
      },
      catch: (e) => e,
    });

    yield* Effect.logInfo("Collection fetch complete").pipe(
      Effect.annotateLogs({
        module: "sync-worker",
        jobId: job.id,
        collectionId: job.collectionId,
        itemCount: fetchedItems.length,
      }),
    );

    // Post items to main thread for SSE broadcast
    if (fetchedItems.length > 0) {
      self.postMessage({
        type: SyncMessageType.ITEMS_FETCHED,
        items: fetchedItems,
        userId,
        collectionId: job.collectionId,
      });
      yield* Effect.logDebug("Items posted to main thread").pipe(
        Effect.annotateLogs({
          module: "sync-worker",
          collectionId: job.collectionId,
          itemCount: fetchedItems.length,
        }),
      );
    }

    yield* completeJob(job.id);
    yield* Effect.logDebug("Job completed").pipe(
      Effect.annotateLogs({ module: "sync-worker", jobId: job.id }),
    );
  }).pipe(
    Effect.catch((e) =>
      Effect.gen(function* () {
        yield* Effect.logError("Job failed").pipe(
          Effect.annotateLogs({ module: "sync-worker", err: e, jobId: job.id }),
        );
        if (isCryptoFailure(e)) {
          yield* failJobPermanently(job.id, getJobFailureMessage(e));
          return;
        }

        yield* failJob(job.id, getJobFailureMessage(e));
      }),
    ),
    Effect.withSpan("syncWorker.processJob", {
      attributes: { jobId: job.id, collectionId: job.collectionId },
    }),
  );

// Sync loop as an Effect
const syncLoop = Effect.gen(function* () {
  const jobs = yield* claimJobs(workerId, MAX_COLLECTION_PULL_SIZE);

  if (jobs.length > 0) {
    yield* Effect.logDebug("Claimed sync jobs").pipe(
      Effect.annotateLogs({ module: "sync-worker", jobCount: jobs.length, workerId }),
    );
  }

  for (const job of jobs) {
    yield* processJob(job);
  }
}).pipe(
  Effect.withSpan("syncWorker.syncLoop"),
  Effect.catch((e) =>
    Effect.logError("Sync error").pipe(Effect.annotateLogs({ module: "sync-worker", err: e })),
  ),
  Effect.repeat(Schedule.fixed(Duration.millis(MIN_FETCH_INTERVAL))),
);

// Start the sync loop
Effect.runFork(syncLoop.pipe(Effect.provide(Layer.mergeAll(WorkerDbLayer, LoggerLive))));

// Signal ready
log.info({ workerId }, "Sync worker ready");
self.postMessage({ type: SyncMessageType.WORKER_READY });
