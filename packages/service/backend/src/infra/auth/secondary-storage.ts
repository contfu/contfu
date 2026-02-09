/* eslint-disable @typescript-eslint/no-explicit-any */
import type { KV } from "@nats-io/kv";
import type { SecondaryStorage, Session, User } from "better-auth";
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
  const bucket = await kvm.create("user-session");
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
  deserialize: (key: string, fields: Buffer) => any,
): Promise<string | null> {
  const cached = cache.get(key);
  if (cached) return cached;

  const value = await bucket.get(key);
  if (!value) return null;

  const fields = Buffer.from(value.value);
  const res = JSON.stringify(deserialize(key, fields));
  cache.set(key, res);
  return res;
}

function serializeActiveSessions(sessions: SessionToken[]): Buffer {
  const fields = Buffer.alloc(sessions.length * 32);
  for (let i = 0; i < sessions.length; i++) {
    fields.writeBigUInt64BE(BigInt(sessions[i].expiresAt), i * 32);
    Buffer.from(sessions[i].token, "base64url").copy(fields, i * 32 + 8);
  }
  return fields;
}

function deserializeActiveSessions(_: string, fields: Buffer): SessionToken[] {
  const sessions: SessionToken[] = [];
  for (let i = 0; i < fields.length; i += 32) {
    const expiresAt = Number(fields.readBigUInt64BE(i));
    const token = fields.subarray(i + 8, i + 32).toString("base64url");
    sessions.push({ token, expiresAt });
  }
  return sessions;
}

function serializeSessionAndUser({
  user,
  session,
}: {
  user: User;
  session: Omit<Session, "id">;
}): Buffer {
  const userBuf = serializeUser(user);
  const sessionBuf = serializeSession(session);
  return Buffer.concat([userBuf, sessionBuf]);
}

function serializeUser(user: User): Buffer {
  const emailLength = user.email.length;
  const nameLength = user.name.length;
  const imageLength = user.image?.length ?? 0;
  const fields = Buffer.alloc(23 + emailLength + nameLength + imageLength);

  // Write user ID as string (PostgreSQL uses varchar IDs)
  const userIdStr = String(user.id);
  fields.writeUInt32LE(parseInt(userIdStr, 10) || 0, 0);

  fields.writeBigUInt64BE(BigInt(new Date(user.createdAt).getTime()), 4);
  fields.writeBigUInt64BE(BigInt(new Date(user.updatedAt).getTime()), 12);
  fields.writeUInt8(emailLength, 20);
  fields.writeUInt8(nameLength, 21);
  fields.writeUInt8(imageLength, 22);
  fields.write(user.email, 23);
  fields.write(user.name, 23 + emailLength);
  if (user.image) {
    fields.write(user.image, 23 + emailLength + nameLength);
  }
  return fields;
}

function serializeSession(session: Omit<Session, "id">): Buffer {
  const ipAddressLength = session.ipAddress?.length ?? 0;
  const userAgentLength = session.userAgent?.length ?? 0;
  const fields = Buffer.alloc(26 + ipAddressLength + userAgentLength);

  fields.writeBigUInt64BE(BigInt(new Date(session.expiresAt).getTime()), 0);
  fields.writeBigUInt64BE(BigInt(new Date(session.createdAt).getTime()), 8);
  fields.writeBigUInt64BE(BigInt(new Date(session.updatedAt).getTime()), 16);
  fields.writeUInt8(ipAddressLength, 24);
  fields.writeUInt8(userAgentLength, 25);

  if (ipAddressLength > 0) {
    fields.write(session.ipAddress!, 26);
  }
  if (userAgentLength > 0) {
    fields.write(session.userAgent!, 26 + ipAddressLength);
  }
  return fields;
}

function deserializeSessionAndUser(
  key: string,
  buf: Buffer,
): { user: User; session: Omit<Session, "id"> } {
  const [user, userLength] = deserializeUser(buf);
  const session = deserializeSession(user.id, key, buf.subarray(userLength));
  return { user, session };
}

function deserializeUser(fields: Buffer): [User, number] {
  const id = fields.readUInt32LE(0).toString();
  const createdAt = new Date(Number(fields.readBigUInt64BE(4)));
  const updatedAt = new Date(Number(fields.readBigUInt64BE(12)));
  const emailLength = fields.readUInt8(20);
  const nameLength = fields.readUInt8(21);
  const imageLength = fields.readUInt8(22);
  const email = fields.subarray(23, 23 + emailLength).toString();
  const name = fields.subarray(23 + emailLength, 23 + emailLength + nameLength).toString();
  const image =
    imageLength > 0
      ? fields
          .subarray(23 + emailLength + nameLength, 23 + emailLength + nameLength + imageLength)
          .toString()
      : null;

  const user: User = {
    id,
    emailVerified: true,
    createdAt,
    updatedAt,
    email,
    name,
    image,
  };
  return [user, 23 + emailLength + nameLength + imageLength];
}

function deserializeSession(userId: string, token: string, fields: Buffer): Omit<Session, "id"> {
  const expiresAt = new Date(Number(fields.readBigUInt64BE(0)));
  const createdAt = new Date(Number(fields.readBigUInt64BE(8)));
  const updatedAt = new Date(Number(fields.readBigUInt64BE(16)));
  const ipAddressLength = fields.readUInt8(24);
  const userAgentLength = fields.readUInt8(25);
  const ipAddress =
    ipAddressLength > 0 ? fields.subarray(26, 26 + ipAddressLength).toString() : undefined;
  const userAgent =
    userAgentLength > 0
      ? fields.subarray(26 + ipAddressLength, 26 + ipAddressLength + userAgentLength).toString()
      : undefined;

  const session: Omit<Session, "id"> = {
    userId,
    token,
    ipAddress,
    userAgent,
    expiresAt,
    createdAt,
    updatedAt,
  };
  return session;
}
