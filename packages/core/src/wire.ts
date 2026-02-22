import type { EventType } from "./events";
import type { SourceType } from "./items";

/**
 * Wire format for binary stream events.
 * Uses tuples for minimal MessagePack encoding size.
 *
 * Format: [type, ...payload] where:
 * - PING: [0] (keep-alive)
 * - CHANGED: [1, wireItem, index] (EventType.CHANGED)
 * - DELETED: [2, itemId, index] (EventType.DELETED)
 */

/** Item-related events sent to consumers via /api/sync. */
export type WireItemEvent =
  | [EventType.CHANGED, WireItem, number]
  | [EventType.DELETED, Uint8Array, number];

/** Schema event: sends collection schema to consumers. */
export type WireSchemaEvent = [EventType.SCHEMA, string, Record<string, number>];

/** Combined wire event type for client connections. */
export type WireEvent =
  | [typeof WIRE_PING]
  | WireItemEvent
  | WireSchemaEvent
  | [typeof WIRE_SNAPSHOT_START]
  | [typeof WIRE_SNAPSHOT_END];

/**
 * Wire item format as tuple:
 * [sourceType, ref, id, collection, changedAt, props, content?]
 */
export type WireItem = [
  SourceType | null, // sourceType (nullable when ref transmission is disabled)
  string | null, // absolute source ref URL (nullable when ref transmission is disabled)
  Uint8Array, // id
  string, // collection name
  number, // changedAt
  Record<string, unknown>, // props
  unknown[]?, // content (optional)
];

/** PING event type constant (not in EventType enum). */
export const WIRE_PING = 0 as const;

/** Snapshot lifecycle wire event constants. */
export const WIRE_SNAPSHOT_START = 3 as const;
export const WIRE_SNAPSHOT_END = 4 as const;
