import { KvWatchInclude, type KV } from "@nats-io/kv";
import type { SecondaryStorage, Session, User } from "better-auth";
import { pack, unpack } from "msgpackr";
import { lru, type LRU } from "tiny-lru";
import { createLogger } from "../logger/index";
import { getKvManager } from "../nats/kvm";

const log = createLogger("auth-sessions");

type SessionToken = { token: string; expiresAt: number };

/** 7 days — matches better-auth default session expiry. */
const SESSION_TTL = 1000 * 60 * 60 * 24 * 7;

const ACTIVE_SESSIONS_PREFIX = "active-sessions-";
const API_KEY_PREFIX = "api-key:";
const VERIFICATION_PREFIX = "verification:";

let sessionsBucket: Promise<KV> | undefined;
let userSessionsBucket: Promise<KV> | undefined;
let verificationBucket: Promise<KV> | undefined;
const sessionsCache: LRU<string> = lru(10_000);
const activeSessionsCache: LRU<string> = lru(5_000);
const apiKeyCache: LRU<string> = lru(5_000);
const verificationCache: LRU<string> = lru(5_000);

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

async function getVerificationBucket(): Promise<KV> {
  return (verificationBucket ??= getKvManager().then((kvm) =>
    kvm.create("verification", { ttl: SESSION_TTL }),
  ));
}

/**
 * Route a better-auth secondary-storage key to the correct bucket/cache,
 * stripping the static prefix so only the actual identifier is stored.
 * Throws on unrecognised key prefixes so new patterns surface immediately.
 */
function routeKey(
  key: string,
):
  | { kind: "session"; actualKey: string }
  | { kind: "active-sessions"; actualKey: string }
  | { kind: "api-key"; actualKey: string }
  | { kind: "verification"; actualKey: string } {
  if (key.startsWith(API_KEY_PREFIX)) {
    return { kind: "api-key", actualKey: key.slice(API_KEY_PREFIX.length) };
  }
  if (key.startsWith(ACTIVE_SESSIONS_PREFIX)) {
    return { kind: "active-sessions", actualKey: key.slice(ACTIVE_SESSIONS_PREFIX.length) };
  }
  if (key.startsWith(VERIFICATION_PREFIX)) {
    return { kind: "verification", actualKey: key.slice(VERIFICATION_PREFIX.length) };
  }
  // Session tokens are plain strings without a prefix.
  // Reject anything that looks like an unknown prefixed key.
  if (key.includes(":")) {
    throw new Error(`Unrecognised secondary-storage key prefix: ${key}`);
  }
  return { kind: "session", actualKey: key };
}

export function createNatsKvSessionStorage(): SecondaryStorage {
  void handleRemoteInvalidations().catch((err) =>
    log.error({ err }, "Failed to start session invalidation watchers"),
  );
  return {
    get: async (key) => {
      const route = routeKey(key);
      switch (route.kind) {
        case "api-key":
          return apiKeyCache.get(route.actualKey) ?? null;
        case "active-sessions":
          return getFromCacheOrBucket(
            activeSessionsCache,
            await getUserSessionsBucket(),
            route.actualKey,
            deserializeActiveSessions,
          );
        case "verification":
          return getFromCacheOrBucket(
            verificationCache,
            await getVerificationBucket(),
            route.actualKey,
            deserializeGeneric,
          );
        case "session":
          return getFromCacheOrBucket(
            sessionsCache,
            await getSessionsBucket(),
            route.actualKey,
            deserializeSessionAndUser,
          );
      }
    },
    set: async (key, value) => {
      const route = routeKey(key);
      switch (route.kind) {
        case "api-key":
          apiKeyCache.set(route.actualKey, value);
          return;
        case "active-sessions": {
          const bucket = await getUserSessionsBucket();
          const parsed = parseJson(key, value);
          await bucket.put(route.actualKey, serializeActiveSessions(parsed as SessionToken[]));
          activeSessionsCache.set(route.actualKey, value);
          return;
        }
        case "verification": {
          const bucket = await getVerificationBucket();
          const parsed = parseJson(key, value);
          await bucket.put(route.actualKey, pack(parsed));
          verificationCache.set(route.actualKey, value);
          return;
        }
        case "session": {
          const bucket = await getSessionsBucket();
          const parsed = parseJson(key, value) as { user: User; session: Omit<Session, "id"> };
          await bucket.put(route.actualKey, serializeSessionAndUser(parsed));
          sessionsCache.set(route.actualKey, value);
          return;
        }
      }
    },
    delete: async (key) => {
      const route = routeKey(key);
      switch (route.kind) {
        case "api-key":
          apiKeyCache.delete(route.actualKey);
          return;
        case "active-sessions": {
          const bucket = await getUserSessionsBucket();
          await bucket.delete(route.actualKey);
          activeSessionsCache.delete(route.actualKey);
          return;
        }
        case "verification": {
          const bucket = await getVerificationBucket();
          await bucket.delete(route.actualKey);
          verificationCache.delete(route.actualKey);
          return;
        }
        case "session": {
          const bucket = await getSessionsBucket();
          await bucket.delete(route.actualKey);
          sessionsCache.delete(route.actualKey);
          return;
        }
      }
    },
  };
}

function parseJson(key: string, value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (err) {
    log.error({ err, key }, "Failed to parse JSON in secondary-storage set");
    throw err;
  }
}

async function handleRemoteInvalidations() {
  const sessionsBucket = await getSessionsBucket();
  const userSessionsBucket = await getUserSessionsBucket();
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
  } catch (err) {
    log.error({ err, key }, "Failed to deserialize cached value");
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

function deserializeGeneric(_: string, data: Uint8Array): unknown {
  return unpack(data);
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
  const [wireUser, wireSession] = unpack(data) as WireSessionAndUser;

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
