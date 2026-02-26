import { EventType } from "./events";
import type { SourceType } from "./items";

/**
 * Wire format for binary stream events.
 * Uses tuples for minimal MessagePack encoding size.
 *
 * Format: [type, ...payload] where:
 * - PING: [0] (keep-alive)
 * - SNAPSHOT_START: [1]
 * - SNAPSHOT_END: [2]
 * - SCHEMA: [10, collectionName, schema] (EventType.SCHEMA)
 * - CHANGED: [30, wireItem, index] (EventType.CHANGED)
 * - DELETED: [31, itemId, index] (EventType.DELETED)
 */

/** Item-related events sent to consumers via /api/sync. */
export type WireItemEvent =
  | [typeof EventType.CHANGED, WireItem, number]
  | [typeof EventType.DELETED, Uint8Array, number];

/** Schema event: sends collection schema to consumers. */
export type WireSchemaEvent = [typeof EventType.SCHEMA, string, Record<string, number>];

/** Combined wire event type for client connections. */
export type WireEvent =
  | [typeof EventType.PING]
  | WireItemEvent
  | WireSchemaEvent
  | [typeof EventType.SNAPSHOT_START]
  | [typeof EventType.SNAPSHOT_END];

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
