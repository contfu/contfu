import { EventType } from "./events";

/**
 * Wire format for binary stream events.
 * Uses tuples for minimal MessagePack encoding size.
 *
 * Format: [type, ...payload] where type matches EventType enum:
 * - CONNECTED: [0] (EventType.CONNECTED)
 * - ERROR: [1, errorCode] (EventType.ERROR)
 * - CHANGED: [2, [ref, id, collection, publishedAt, createdAt, changedAt, props, content?]] (EventType.CHANGED)
 * - DELETED: [3, deletedItemId] (EventType.DELETED)
 * - LIST_IDS: [4, collection, ids[]] (EventType.LIST_IDS)
 * - CHECKSUM: [5, collection, checksum] (EventType.CHECKSUM)
 * - PING: [6] (keep-alive)
 */
export type WireEvent =
  | [EventType.CONNECTED]
  | [EventType.ERROR, string]
  | [EventType.CHANGED, WireItem]
  | [EventType.DELETED, Uint8Array]
  | [EventType.LIST_IDS, number, Uint8Array[]]
  | [EventType.CHECKSUM, number, Uint8Array]
  | [6]; // PING = 6

/**
 * Wire item format as tuple:
 * [ref, id, collection, publishedAt, createdAt, changedAt, props, content?]
 */
export type WireItem = [
  Uint8Array, // ref
  Uint8Array, // id
  number, // collection
  number, // publishedAt
  number, // createdAt
  number, // changedAt
  Record<string, unknown>, // props
  unknown[]?, // content (optional)
];

/** PING event type constant (not in EventType enum). */
export const WIRE_PING = 6 as const;
