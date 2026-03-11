/// <reference lib="webworker" />
declare const self: Worker;

import { ConnectionType } from "@contfu/core";
import { createLogger, LoggerLive } from "@contfu/svc-backend/infra/logger/index";
import { claimJobs } from "@contfu/svc-backend/features/sync-jobs/claimJobs";
import { completeJob } from "@contfu/svc-backend/features/sync-jobs/completeJob";
import { failJob } from "@contfu/svc-backend/features/sync-jobs/failJob";
import { getJobConfig } from "@contfu/svc-backend/features/sync-jobs/getJobConfig";
import { SyncMessageType, type UserSyncItem } from "@contfu/svc-backend/infra/sync-worker/messages";
import {
  getItemRefForSource,
  notionSource,
  strapiSource,
  webSource,
  contentfulSource,
} from "@contfu/svc-sources";
import { Duration, Effect, Schedule } from "effect";
import { workerDb } from "./db/worker-db";

const log = createLogger("sync-worker");

// Constants
const MAX_COLLECTION_PULL_SIZE = Number(process.env.MAX_COLLECTION_PULL_SIZE ?? 10_000);
const MIN_FETCH_INTERVAL = Number(process.env.MIN_FETCH_INTERVAL ?? 10_000);

// Worker identity
const workerId = crypto.randomUUID();

// Handle messages from the app
self.onmessage = (e: MessageEvent) => {
  if (e.data.type === SyncMessageType.SHUTDOWN) {
    process.exit(0);
  }
};

// Job processing as an Effect
const processJob = (job: { id: number; collectionId: number }) =>
  Effect.gen(function* () {
    const config = yield* Effect.tryPromise({
      try: () => Effect.runPromise(getJobConfig(workerDb, { collectionId: job.collectionId })),
      catch: (e) => e,
    });
    if (!config) {
      yield* Effect.logWarning("Collection config not found").pipe(
        Effect.annotateLogs({
          module: "sync-worker",
          jobId: job.id,
          collectionId: job.collectionId,
        }),
      );
      yield* Effect.tryPromise({
        try: () => Effect.runPromise(failJob(workerDb, job.id, "Collection config not found")),
        catch: (e) => e,
      });
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

    yield* Effect.tryPromise({
      try: () => Effect.runPromise(completeJob(workerDb, job.id)),
      catch: (e) => e,
    });
    yield* Effect.logDebug("Job completed").pipe(
      Effect.annotateLogs({ module: "sync-worker", jobId: job.id }),
    );
  }).pipe(
    Effect.catchAll((e) =>
      Effect.gen(function* () {
        yield* Effect.logError("Job failed").pipe(
          Effect.annotateLogs({ module: "sync-worker", err: e, jobId: job.id }),
        );
        yield* Effect.tryPromise({
          try: () => Effect.runPromise(failJob(workerDb, job.id, String(e))),
          catch: () => void 0,
        });
      }),
    ),
    Effect.withSpan("syncWorker.processJob", {
      attributes: { jobId: job.id, collectionId: job.collectionId },
    }),
  );

// Sync loop as an Effect
const syncLoop = Effect.gen(function* () {
  const jobs = yield* Effect.tryPromise({
    try: () => Effect.runPromise(claimJobs(workerDb, workerId, MAX_COLLECTION_PULL_SIZE)),
    catch: (e) => e,
  });

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
  Effect.catchAll((e) =>
    Effect.logError("Sync error").pipe(Effect.annotateLogs({ module: "sync-worker", err: e })),
  ),
  Effect.repeat(Schedule.fixed(Duration.millis(MIN_FETCH_INTERVAL))),
);

// Start the sync loop
Effect.runFork(syncLoop.pipe(Effect.provide(LoggerLive)));

// Signal ready
log.info({ workerId }, "Sync worker ready");
self.postMessage({ type: SyncMessageType.WORKER_READY });
