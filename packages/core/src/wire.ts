import { ApplicationCommand, CommandResult, type RefreshStatus } from "./commands";
import { ClientEventType, EventType } from "./events";
import { defineEnum, type EnumValue } from "./enums";
import type { EffectiveCollectionI18nConfig } from "./i18n";
import { isObjectEqual } from "./objects";
import type { CollectionSchema } from "./schemas";

/**
 * Wire format for binary stream events.
 * Uses tuples for minimal MessagePack encoding size.
 *
 * Format: [type, ...payload] where:
 * - PING: [0] (keep-alive)
 * - SNAPSHOT_START: [1]
 * - SNAPSHOT_END: [2]
 * - COLLECTION_SCHEMA: [10, collectionName, displayName, schema, i18n?, schemaHash?, index?] (EventType.COLLECTION_SCHEMA)
 * - COLLECTION_RENAMED: [11, oldName, newName, newDisplayName, index] (EventType.COLLECTION_RENAMED)
 * - COLLECTION_REMOVED: [12, collectionName, index] (EventType.COLLECTION_REMOVED)
 * - ITEM_CHANGED: [30, wireItem, index] (EventType.ITEM_CHANGED)
 * - ITEM_DELETED: [31, itemId, index] (EventType.ITEM_DELETED)
 * - COMMAND_RESULT_REFRESH: [50, commandId, status, ignoredItemIds?] (CommandResult.REFRESH)
 * - COMMAND_RESULT_REFRESH_ALL: [51, commandId, status] (CommandResult.REFRESH_ALL)
 */

/** Item-related events sent to consumers via /api/sync. */
export type WireItemEvent =
  | [typeof EventType.ITEM_CHANGED, WireItemPatch, number]
  | [typeof EventType.ITEM_DELETED, number, number];

/** Schema event: sends collection schema to consumers. */
export type WireSchemaEvent =
  | [typeof EventType.COLLECTION_SCHEMA, string, string, CollectionSchema]
  | [
      typeof EventType.COLLECTION_SCHEMA,
      string,
      string,
      CollectionSchema,
      EffectiveCollectionI18nConfig,
    ]
  | [
      typeof EventType.COLLECTION_SCHEMA,
      string,
      string,
      CollectionSchema,
      EffectiveCollectionI18nConfig | undefined,
      number,
    ]
  | [
      typeof EventType.COLLECTION_SCHEMA,
      string,
      string,
      CollectionSchema,
      EffectiveCollectionI18nConfig | undefined,
      Buffer,
      number,
    ];

/** Collection renamed event: notifies consumers of a collection name change. */
export type WireCollectionRenamedEvent =
  | [typeof EventType.COLLECTION_RENAMED, string, string, string]
  | [typeof EventType.COLLECTION_RENAMED, string, string, string, number];

/** Collection removed event: notifies consumers that a collection was removed. */
export type WireCollectionRemovedEvent =
  | [typeof EventType.COLLECTION_REMOVED, string]
  | [typeof EventType.COLLECTION_REMOVED, string, number];

/** Combined wire event type for client integrations. */
export type WireCommandResult =
  | [typeof CommandResult.REFRESH, number, RefreshStatus, number[]?]
  | [typeof CommandResult.REFRESH_ALL, number, RefreshStatus];

export const FileLeaseResultStatus = defineEnum({
  REDIRECT: 1,
  GONE: 2,
  NOT_FOUND: 3,
  RETRY: 4,
  UNAUTHORIZED: 5,
});
export type FileLeaseResultStatus = EnumValue<typeof FileLeaseResultStatus>;

/** A stable managed-file URL plus an optional provider capability and expiry. */
export type WireFileLink = [stableUrl: string, leaseUrl?: string, expiresAt?: number];

export function isWireFileLink(value: unknown): value is WireFileLink {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.length <= 3 &&
    typeof value[0] === "string" &&
    typeof value[1] === "string" &&
    (value.length < 3 || (typeof value[2] === "number" && Number.isFinite(value[2])))
  );
}

export type WireLeaseResponse = [
  typeof EventType.FILE_LEASE_RESPONSE,
  requestId: number,
  status: FileLeaseResultStatus,
  leaseUrl?: string,
  expiresAt?: number,
];

export type WireEvent =
  | [typeof EventType.PING]
  | WireLeaseResponse
  | WireItemEvent
  | WireSchemaEvent
  | WireCollectionRenamedEvent
  | WireCollectionRemovedEvent
  | [typeof EventType.SNAPSHOT_START]
  | [typeof EventType.SNAPSHOT_END]
  | WireCommandResult;

/** Client-to-server WebSocket control messages. */
export type WireEventBatch = WireEvent[];

export type WireStreamPayload = WireEvent | WireEventBatch;

export const BatchEffectType = defineEnum({
  UPSERT: 1,
  DELETE: 2,
});
export type BatchEffectType = EnumValue<typeof BatchEffectType>;

export type WireRefreshCommand = [
  typeof ApplicationCommand.REFRESH,
  number,
  string,
  number[],
  boolean?,
];
export type WireRefreshAllCommand = [
  typeof ApplicationCommand.REFRESH_ALL,
  number,
  string,
  boolean?,
];
export type WireCommand = WireRefreshCommand | WireRefreshAllCommand;

export type WireLeaseRequest = [
  typeof ClientEventType.FILE_LEASE_REQUEST,
  requestId: number,
  integrationType: number,
  /** The source collection route selector is encoded and validated by the authorized server. */
  sourceCollectionId: string,
  /** The managed item route selector is a plain numeric ID. */
  itemId: string | number,
  handle: string,
];

export type ClientWireEvent = [typeof ClientEventType.ACK] | WireLeaseRequest | WireCommand;

export function isWireLeaseRequest(value: unknown): value is WireLeaseRequest {
  return (
    Array.isArray(value) &&
    value.length === 6 &&
    value[0] === ClientEventType.FILE_LEASE_REQUEST &&
    typeof value[1] === "number" &&
    Number.isSafeInteger(value[1]) &&
    typeof value[2] === "number" &&
    Number.isSafeInteger(value[2]) &&
    typeof value[3] === "string" &&
    value[3].length > 0 &&
    isUnencodedNumericId(value[4]) &&
    typeof value[5] === "string"
  );
}

function isUnencodedNumericId(value: unknown): value is string | number {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return false;
  return Number.isSafeInteger(Number(value));
}

export function isWireLeaseResponse(value: unknown): value is WireLeaseResponse {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    value.length <= 5 &&
    value[0] === EventType.FILE_LEASE_RESPONSE &&
    typeof value[1] === "number" &&
    Number.isSafeInteger(value[1]) &&
    typeof value[2] === "number" &&
    Object.values(FileLeaseResultStatus).includes(value[2] as FileLeaseResultStatus) &&
    (value.length < 4 || typeof value[3] === "string") &&
    (value.length < 5 || (typeof value[4] === "number" && Number.isFinite(value[4])))
  );
}

/**
 * Full wire item tuple:
 * [id, collection, changedAt, props, content?]
 */
export type WireItem = [
  number, // user-scoped item registry id
  string, // collection name
  number, // changedAt
  Record<string, unknown>, // props
  unknown[]?, // content (optional)
];

/**
 * Sparse ITEM_CHANGED tuple:
 * [id, collection, changedAt, props?, content?]
 *
 * Identity fields are always present. Omitted props/content mean unchanged.
 * Props patch shallowly by key; a prop value of `undefined` deletes/unsets that prop.
 * Content patches as a whole field; omitted content is unchanged and [] means no content.
 * A full WireItem remains a valid full patch.
 */
export type WireItemPatch = [number, string, number, Record<string, unknown>?, unknown[]?];

export function patchWireItemProps(
  previous: Record<string, unknown>,
  patch?: Record<string, unknown>,
): Record<string, unknown> {
  if (patch === undefined) return { ...previous };
  const next = { ...previous };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }
  return next;
}

export function materializeWireItemPatch(patch: WireItemPatch, previous?: WireItem): WireItem {
  const [id, collection, changedAt, propsPatch, contentPatch] = patch;
  const props = patchWireItemProps(previous?.[3] ?? {}, propsPatch);
  const next: WireItem = [id, collection, changedAt, props];
  if (contentPatch !== undefined) {
    next.push(contentPatch);
  } else if (previous && previous.length > 4) {
    next.push(previous[4]);
  }
  return next;
}

export function diffWireItemPatch(previous: WireItem | undefined, next: WireItem): WireItemPatch {
  if (!previous) return next;
  const propPatch: Record<string, unknown> = {};
  let hasPropPatch = false;
  const previousProps = previous[3] ?? {};
  const nextProps = next[3] ?? {};
  for (const [key, value] of Object.entries(nextProps)) {
    if (!isObjectEqual(previousProps[key], value)) {
      propPatch[key] = value;
      hasPropPatch = true;
    }
  }
  for (const key of Object.keys(previousProps)) {
    if (!(key in nextProps)) {
      propPatch[key] = undefined;
      hasPropPatch = true;
    }
  }

  const contentChanged =
    next.length > 4 ? !isObjectEqual(previous[4], next[4]) : previous.length > 4;
  const patch: WireItemPatch = [next[0], next[1], next[2]];
  if (hasPropPatch || contentChanged) patch.push(hasPropPatch ? propPatch : undefined);
  if (contentChanged) patch.push(next.length > 4 ? next[4] : []);
  return patch;
}
