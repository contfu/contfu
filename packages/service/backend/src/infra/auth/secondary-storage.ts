import { KvWatchInclude, type KV } from "@nats-io/kv";
import type { SecondaryStorage, Session, User } from "better-auth";
import { pack, unpack } from "msgpackr";
import { lru, type LRU } from "tiny-lru";
import { createLogger } from "../logger/index";
import { hasNats } from "../nats/connection";
import { getKvManager } from "../nats/kvm";

const log = createLogger("auth-sessions");

type SessionToken = { token: string; expiresAt: number };

const SESSION_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days
const API_KEY_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days
const ACTIVE_SESSIONS_PREFIX = "active-sessions-";
const API_KEY_PREFIX = "api-key:";

/** NATS KV keys don't allow colons — replace with dots */
function natsKey(key: string): string {
  return key.replaceAll(":", ".");
}

let sessionsBucket: Promise<KV> | undefined;
let userSessionsBucket: Promise<KV> | undefined;
let apiKeyBucket: Promise<KV> | undefined;
const sessionsCache: LRU<string> = lru(10_000);
const activeSessionsCache: LRU<string> = lru(5_000);
const apiKeyCache: LRU<string> = lru(5_000);

async function getSessionsBucket(): Promise<KV> {
  return (sessionsBucket ??= getKvManager().then((kvm) =>
    kvm.create("session", { ttl: SESSION_TTL }),
  ));
}

async function getUserSessionsBucket(): Promise<KV> {
  return (userSessionsBucket ??= getKvManager().then((kvm) =>
    kvm.create("user-session", { ttl: SESSION_TTL }),
  ));
}

async function getApiKeyBucket(): Promise<KV> {
  return (apiKeyBucket ??= getKvManager().then((kvm) =>
    kvm.create("api-key", { ttl: API_KEY_TTL }),
  ));
}

export function createNatsKvSessionStorage(): SecondaryStorage | undefined {
  if (!hasNats()) return undefined;
  void handleRemoteInvalidations();
  return {
    get: async (key) => {
      if (key.startsWith(API_KEY_PREFIX)) {
        return getFromCacheOrBucket(
          apiKeyCache,
          await getApiKeyBucket(),
          natsKey(key),
          passthrough,
        );
      }
      if (key.startsWith(ACTIVE_SESSIONS_PREFIX)) {
        const actualKey = key.slice(ACTIVE_SESSIONS_PREFIX.length);
        return getFromCacheOrBucket(
          activeSessionsCache,
          await getUserSessionsBucket(),
          actualKey,
          deserializeActiveSessions,
        );
      }
      return getFromCacheOrBucket(
        sessionsCache,
        await getSessionsBucket(),
        key,
        deserializeSessionAndUser,
      );
    },
    set: async (key, value) => {
      if (key.startsWith(API_KEY_PREFIX)) {
        const bucket = await getApiKeyBucket();
        await bucket.put(natsKey(key), new TextEncoder().encode(value));
        apiKeyCache.set(natsKey(key), value);
        return;
      }
      if (key.startsWith(ACTIVE_SESSIONS_PREFIX)) {
        const actualKey = key.slice(ACTIVE_SESSIONS_PREFIX.length);
        const bucket = await getUserSessionsBucket();
        await bucket.put(actualKey, serializeActiveSessions(JSON.parse(value)));
        activeSessionsCache.set(actualKey, value);
        return;
      }
      const bucket = await getSessionsBucket();
      await bucket.put(key, serializeSessionAndUser(JSON.parse(value)));
      sessionsCache.set(key, value);
    },
    delete: async (key) => {
      if (key.startsWith(API_KEY_PREFIX)) {
        const bucket = await getApiKeyBucket();
        await bucket.delete(natsKey(key));
        apiKeyCache.delete(natsKey(key));
        return;
      }
      if (key.startsWith(ACTIVE_SESSIONS_PREFIX)) {
        const actualKey = key.slice(ACTIVE_SESSIONS_PREFIX.length);
        const bucket = await getUserSessionsBucket();
        await bucket.delete(actualKey);
        activeSessionsCache.delete(actualKey);
        return;
      }
      const bucket = await getSessionsBucket();
      await bucket.delete(key);
      sessionsCache.delete(key);
    },
  };
}

function passthrough(_: string, data: Uint8Array): unknown {
  return JSON.parse(new TextDecoder().decode(data));
}

async function handleRemoteInvalidations() {
  const sessionsBucket = await getSessionsBucket();
  const userSessionsBucket = await getUserSessionsBucket();
  const apiKeyBkt = await getApiKeyBucket();
  void apiKeyBkt
    .watch({ include: KvWatchInclude.UpdatesOnly })
    .then(async (watcher) => {
      for await (const event of watcher) {
        if (event.operation === "DEL") {
          apiKeyCache.delete(event.key);
        }
      }
    })
    .catch((err) => log.error({ err }, "API key cache watcher error"));
  void sessionsBucket
    .watch({ include: KvWatchInclude.UpdatesOnly })
    .then(async (watcher) => {
      for await (const event of watcher) {
        if (event.operation === "DEL") {
          const { key } = event;
          sessionsCache.delete(key);
        }
      }
    })
    .catch((err) => log.error({ err }, "Session cache watcher error"));

  void userSessionsBucket
    .watch({ include: KvWatchInclude.UpdatesOnly })
    .then(async (watcher) => {
      for await (const event of watcher) {
        if (event.operation === "DEL") {
          const { key } = event;
          activeSessionsCache.delete(key);
        }
      }
    })
    .catch((err) => log.error({ err }, "User sessions cache watcher error"));
}

async function getFromCacheOrBucket(
  cache: LRU<string>,
  bucket: KV,
  key: string,
  deserialize: (key: string, data: Uint8Array) => unknown,
): Promise<string | null> {
  const cached = cache.get(key);
  if (cached) return cached;

  const value = await bucket.get(key);
  if (!value) return null;

  let deserialized: unknown;
  try {
    deserialized = deserialize(key, value.value);
  } catch {
    return null;
  }
  const res = JSON.stringify(deserialized);
  cache.set(key, res);
  return res;
}

/**
 * Active sessions: array of [token, expiresAt] tuples
 */
type WireActiveSessions = [string, number][];

function serializeActiveSessions(sessions: SessionToken[]): Uint8Array {
  const wire: WireActiveSessions = sessions.map((s) => [s.token, s.expiresAt]);
  return pack(wire);
}

function deserializeActiveSessions(_: string, data: Uint8Array): SessionToken[] {
  try {
    const wire = unpack(data) as WireActiveSessions;
    return wire.map(([token, expiresAt]) => ({ token, expiresAt }));
  } catch (err) {
    log.warn({ err }, "Failed to deserialize active sessions, returning empty");
    return [];
  }
}

/**
 * User: [id, createdAt, updatedAt, email, name, image, emailVerified]
 */
type WireUser = [number, number, number, string, string, string | null, boolean];

/**
 * Session: [expiresAt, createdAt, updatedAt, ipAddress, userAgent]
 */
type WireSession = [number, number, number, string | null, string | null];

/**
 * SessionAndUser: [WireUser, WireSession]
 */
type WireSessionAndUser = [WireUser, WireSession];

function serializeSessionAndUser({
  user,
  session,
}: {
  user: User;
  session: Omit<Session, "id">;
}): Uint8Array {
  const wireUser: WireUser = [
    parseInt(String(user.id), 10) || 0,
    new Date(user.createdAt).getTime(),
    new Date(user.updatedAt).getTime(),
    user.email,
    user.name,
    user.image ?? null,
    !!user.emailVerified,
  ];
  const wireSession: WireSession = [
    new Date(session.expiresAt).getTime(),
    new Date(session.createdAt).getTime(),
    new Date(session.updatedAt).getTime(),
    session.ipAddress ?? null,
    session.userAgent ?? null,
  ];
  return pack([wireUser, wireSession] satisfies WireSessionAndUser);
}

function deserializeSessionAndUser(
  key: string,
  data: Uint8Array,
): { user: User; session: Omit<Session, "id"> } {
  let wireUser: WireUser;
  let wireSession: WireSession;
  try {
    [wireUser, wireSession] = unpack(data) as WireSessionAndUser;
  } catch (err) {
    log.warn({ err, key }, "Failed to deserialize session, returning null");
    throw err;
  }

  const user: User = {
    id: wireUser[0].toString(),
    createdAt: new Date(wireUser[1]),
    updatedAt: new Date(wireUser[2]),
    email: wireUser[3],
    name: wireUser[4],
    image: wireUser[5],
    emailVerified: wireUser[6],
  };

  const session: Omit<Session, "id"> = {
    userId: user.id,
    token: key,
    expiresAt: new Date(wireSession[0]),
    createdAt: new Date(wireSession[1]),
    updatedAt: new Date(wireSession[2]),
    ipAddress: wireSession[3] ?? undefined,
    userAgent: wireSession[4] ?? undefined,
  };

  return { user, session };
}
