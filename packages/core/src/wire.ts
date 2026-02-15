import type { EventType } from "./events";

/**
 * Wire format for binary stream events.
 * Uses tuples for minimal MessagePack encoding size.
 *
 * Format: [type, ...payload] where:
 * - PING: [0] (keep-alive)
 * - CHANGED: [1, wireItem] or [1, wireItem, eventIndex] (EventType.CHANGED)
 * - DELETED: [2, itemId] or [2, itemId, eventIndex] (EventType.DELETED)
 */

/** Item-related events, optionally with trailing eventIndex for replay. */
export type WireItemEvent =
  | [EventType.CHANGED, WireItem]
  | [EventType.CHANGED, WireItem, number]
  | [EventType.DELETED, Uint8Array]
  | [EventType.DELETED, Uint8Array, number];

/** Combined wire event type for client connections. */
export type WireEvent = [typeof WIRE_PING] | WireItemEvent;

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
export const WIRE_PING = 0 as const;
