import type { KV } from "@nats-io/kv";
import { createLogger } from "../logger/index";
import { getKvManager } from "./kvm";

const log = createLogger("leader-election");

/** 5 s — short TTL ensures quick failover if a leader process crashes. */
const LEADER_TTL = 5000;

/** 3 s — shorter than TTL so a standby can claim leadership before the key expires. */
const LEADER_RETRY_INTERVAL = 3000;

// Generate a unique instance ID for this process
const instanceId = crypto.randomUUID();

let leaderKv: KV | undefined;
const leaderMap = new Map<string, boolean>();

async function getLeaderKv(): Promise<KV> {
  if (leaderKv) return leaderKv;

  const kvm = await getKvManager();
  const kv = await kvm.create("leader", { ttl: LEADER_TTL, markerTTL: LEADER_TTL });
  leaderKv = kv;
  return kv;
}

export function isLeader(subject: string): boolean {
  return leaderMap.get(subject) ?? false;
}

export async function* raceForLeader(
  subject: string,
  { interval = LEADER_RETRY_INTERVAL } = {},
): AsyncGenerator<boolean> {
  const kv = await getLeaderKv();

  while (true) {
    const leader = leaderMap.get(subject);
    if (leader) {
      // Refresh our leadership
      await kv.put(subject, instanceId);
    } else {
      const isNowLeader = await tryBecomeLeader(kv, subject);
      if (leader !== isNowLeader) {
        leaderMap.set(subject, isNowLeader);
        if (isNowLeader) log.info({ subject }, "Acquired leadership");
        yield isNowLeader;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

async function tryBecomeLeader(kv: KV, subject: string): Promise<boolean> {
  try {
    await kv.create(subject, instanceId);
    return true;
  } catch {
    return false;
  }
}
