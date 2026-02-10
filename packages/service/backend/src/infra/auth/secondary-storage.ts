import type { KV } from "@nats-io/kv";
import type { SecondaryStorage, Session, User } from "better-auth";
import { pack, unpack } from "msgpackr";
import { lru, type LRU } from "tiny-lru";
import { hasNats } from "../nats/connection";
import { getKvManager } from "../nats/kvm";

type SessionToken = { token: string; expiresAt: number };

const SESSION_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days
const SESSIONS_PREFIX = "s-";

let sessionsBucket: KV | undefined;
let userSessionsBucket: KV | undefined;
const sessionsCache: LRU<string> = lru(10_000);
const activeSessionsCache: LRU<string> = lru(5_000);

async function getSessionsBucket(): Promise<KV> {
  if (sessionsBucket) return sessionsBucket;
  const kvm = await getKvManager();
  const bucket = await kvm.create("session", { ttl: SESSION_TTL });
  sessionsBucket = bucket;
  return bucket;
}

async function getUserSessionsBucket(): Promise<KV> {
  if (userSessionsBucket) return userSessionsBucket;
  const kvm = await getKvManager();
  const bucket = await kvm.create("user-session", { ttl: SESSION_TTL });
  userSessionsBucket = bucket;
  return bucket;
}

export async function getNatsKvSessionStorage(): Promise<SecondaryStorage | undefined> {
  if (!hasNats()) return undefined;

  return {
    get: async (key) => {
      if (key.startsWith(SESSIONS_PREFIX)) {
        const actualKey = key.slice(SESSIONS_PREFIX.length);
        return await getFromCacheOrBucket(
          activeSessionsCache,
          await getUserSessionsBucket(),
          actualKey,
          deserializeActiveSessions,
        );
      }
      return await getFromCacheOrBucket(
        sessionsCache,
        await getSessionsBucket(),
        key,
        deserializeSessionAndUser,
      );
    },
    set: async (key, value) => {
      if (key.startsWith(SESSIONS_PREFIX)) {
        const actualKey = key.slice(SESSIONS_PREFIX.length);
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
      if (key.startsWith(SESSIONS_PREFIX)) {
        const actualKey = key.slice(SESSIONS_PREFIX.length);
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

  const res = JSON.stringify(deserialize(key, value.value));
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
  const wire = unpack(data) as WireActiveSessions;
  return wire.map(([token, expiresAt]) => ({ token, expiresAt }));
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
