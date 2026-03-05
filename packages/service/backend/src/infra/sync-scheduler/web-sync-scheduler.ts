import { SourceType } from "@contfu/core";
import { Effect } from "effect";
import { createLogger } from "../logger/index";
import { hasNats } from "../nats/connection";
import { raceForLeader } from "../nats/leader-election";
import { db } from "../db/db";
import { sourceTable, sourceCollectionTable, influxTable } from "../db/schema";
import { eq } from "drizzle-orm";
import { enqueueSyncJobs } from "../../features/sync-jobs/enqueueSyncJobs";

const log = createLogger("web-sync-scheduler");

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let stopController: AbortController | null = null;

function getIntervalMs(): number {
  const env = process.env.WEB_SYNC_INTERVAL_MS;
  if (env) {
    const parsed = Number.parseInt(env, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_INTERVAL_MS;
}

async function getWebSourceCollectionIds(): Promise<number[]> {
  const rows = await db
    .selectDistinct({ id: sourceCollectionTable.id })
    .from(sourceCollectionTable)
    .innerJoin(sourceTable, eq(sourceCollectionTable.sourceId, sourceTable.id))
    .innerJoin(influxTable, eq(influxTable.sourceCollectionId, sourceCollectionTable.id))
    .where(eq(sourceTable.type, SourceType.WEB));

  return rows.map((r) => r.id);
}

async function runSync(): Promise<void> {
  const ids = await getWebSourceCollectionIds();
  if (ids.length === 0) {
    log.debug("No web source collections with influxes found");
    return;
  }

  log.info({ count: ids.length, ids }, "Enqueuing web sync jobs");
  await Effect.runPromise(enqueueSyncJobs(db, ids));
}

export async function startWebSyncScheduler(): Promise<void> {
  stopController = new AbortController();
  const { signal } = stopController;
  const intervalMs = getIntervalMs();

  if (hasNats()) {
    // Use leader election so only one instance runs the scheduler
    const leader = raceForLeader("web-sync-scheduler");
    for await (const isLeader of leader) {
      if (signal.aborted) break;
      if (isLeader) {
        log.info({ intervalMs }, "Web sync scheduler started (leader)");
        runSchedulerLoop(intervalMs, signal);
      }
    }
  } else {
    // Local mode — always run
    log.info({ intervalMs }, "Web sync scheduler started (local mode)");
    runSchedulerLoop(intervalMs, signal);
  }
}

function runSchedulerLoop(intervalMs: number, signal: AbortSignal): void {
  const tick = () => {
    if (signal.aborted) return;
    runSync()
      .catch((err) => log.error({ err }, "Web sync scheduler error"))
      .finally(() => {
        if (!signal.aborted) {
          setTimeout(tick, intervalMs);
        }
      });
  };
  // Run first sync after one interval
  setTimeout(tick, intervalMs);
}

export function stopWebSyncScheduler(): void {
  if (stopController) {
    stopController.abort();
    stopController = null;
    log.info("Web sync scheduler stopped");
  }
}
