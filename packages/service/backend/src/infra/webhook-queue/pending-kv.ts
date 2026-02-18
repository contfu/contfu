import type { KV } from "@nats-io/kv";
import { getKvManager } from "../nats/kvm";

const PENDING_BUCKET = "wh-pending";

let pendingKv: Promise<KV> | null = null;

export function buildPendingKey(userId: number, sourceId: number, pageId: string): string {
  return `${userId}.${sourceId}.${pageId}`;
}

async function getPendingKv(): Promise<KV> {
  return (pendingKv ??= getKvManager().then((kvm) => kvm.create(PENDING_BUCKET)));
}

function isDuplicateCreateError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("wrong last sequence") || message.includes("key exists");
}

export async function markPending(
  userId: number,
  sourceId: number,
  pageId: string,
  kv: Pick<KV, "create"> | null = null,
): Promise<boolean> {
  const store = kv ?? (await getPendingKv());
  const key = buildPendingKey(userId, sourceId, pageId);

  try {
    await store.create(key, Buffer.from(String(Date.now()), "utf8"));
    return true;
  } catch (error) {
    if (isDuplicateCreateError(error)) return false;
    throw error;
  }
}

export async function isPending(
  userId: number,
  sourceId: number,
  pageId: string,
  kv: Pick<KV, "get"> | null = null,
): Promise<boolean> {
  const store = kv ?? (await getPendingKv());
  const key = buildPendingKey(userId, sourceId, pageId);
  const entry = await store.get(key);
  return entry !== null;
}

export async function cancelPending(
  userId: number,
  sourceId: number,
  pageId: string,
  kv: Pick<KV, "delete"> | null = null,
): Promise<void> {
  const store = kv ?? (await getPendingKv());
  const key = buildPendingKey(userId, sourceId, pageId);
  await store.delete(key);
}

export async function clearPending(
  userId: number,
  sourceId: number,
  pageId: string,
  kv: Pick<KV, "delete"> | null = null,
): Promise<void> {
  await cancelPending(userId, sourceId, pageId, kv);
}
