import type { KV } from "@nats-io/kv";
import { getKvManager } from "./kvm";

const LEADER_TTL = 5000;
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
  { interval = LEADER_RETRY_INTERVAL, ttl: _ttl = LEADER_TTL } = {},
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
        if (isNowLeader) console.log("I am leader for", subject);
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
