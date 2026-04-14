import { ClientEventType, EventType } from "./events";
import type { ConnectionType } from "./connections";
import type { CollectionSchema } from "./schemas";

/**
 * Wire format for binary stream events.
 * Uses tuples for minimal MessagePack encoding size.
 *
 * Format: [type, ...payload] where:
 * - PING: [0] (keep-alive)
 * - SNAPSHOT_START: [1]
 * - SNAPSHOT_END: [2]
 * - COLLECTION_SCHEMA: [10, collectionName, displayName, schema] (EventType.COLLECTION_SCHEMA)
 * - COLLECTION_RENAMED: [11, oldName, newName, newDisplayName] (EventType.COLLECTION_RENAMED)
 * - COLLECTION_REMOVED: [12, collectionName] (EventType.COLLECTION_REMOVED)
 * - ITEM_CHANGED: [30, wireItem, index] (EventType.ITEM_CHANGED)
 * - ITEM_DELETED: [31, itemId, index] (EventType.ITEM_DELETED)
 */

/** Item-related events sent to consumers via /api/sync. */
export type WireItemEvent =
  | [typeof EventType.ITEM_CHANGED, WireItem, number]
  | [typeof EventType.ITEM_DELETED, Uint8Array, number];

/** Schema event: sends collection schema to consumers. */
export type WireSchemaEvent = [
  typeof EventType.COLLECTION_SCHEMA,
  string, // collectionName
  string, // displayName
  CollectionSchema, // schema
  Record<string, string>?, // renames: oldName → newName (optional)
];

/** Collection renamed event: notifies consumers of a collection name change. */
export type WireCollectionRenamedEvent = [
  typeof EventType.COLLECTION_RENAMED,
  string,
  string,
  string,
];

/** Collection removed event: notifies consumers that a collection was removed. */
export type WireCollectionRemovedEvent = [typeof EventType.COLLECTION_REMOVED, string];

/** Combined wire event type for client connections. */
export type WireEvent =
  | [typeof EventType.PING]
  | WireItemEvent
  | WireSchemaEvent
  | WireCollectionRenamedEvent
  | WireCollectionRemovedEvent
  | [typeof EventType.SNAPSHOT_START]
  | [typeof EventType.SNAPSHOT_END];

/** Client-to-server WebSocket control messages. */
export type ClientWireEvent = [typeof ClientEventType.ACK, number];

/**
 * Wire item format as tuple:
 * [sourceType, ref, id, collection, changedAt, props, content?]
 */
export type WireItem = [
  ConnectionType | null, // sourceType (nullable when ref transmission is disabled)
  string | null, // absolute source ref URL (nullable when ref transmission is disabled)
  Uint8Array, // id
  string, // collection name
  number, // changedAt
  Record<string, unknown>, // props
  unknown[]?, // content (optional)
];
