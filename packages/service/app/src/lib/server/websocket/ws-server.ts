import {
  CommandType,
  EventType,
  type AckCommand,
  type ChangedEvent,
  type ChecksumEvent,
  type Command,
  type ConnectedEvent,
  type ConnectCommand,
  type DeletedEvent,
  type ErrorEvent,
  type ItemEvent,
  type ListIdsEvent,
  type UserSyncItem,
} from "@contfu/core";
import { eq } from "drizzle-orm";
import { pack, unpack } from "msgpackr";
import { consumerTable, db } from "../db/db";
import type { SyncWorkerManager } from "../sync-worker/worker-manager";

type BunWebSocket<T> = {
  data: T;
  send(data: string | Buffer): void;
};

class CommandError extends Error {
  constructor(
    readonly code: "E_AUTH" | "E_CONFLICT" | "E_ACCESS",
    message?: string,
  ) {
    super(message);
  }
}

/** Maps consumer key (hex) to WebSocket. */
const consumerToSocket = new Map<string, BunWebSocket<WsData>>();
/** Maps socket ID to consumer key (hex). */
const socketToConsumer = new Map<string, string>();
/** Maps consumer key (hex) to consumer info. */
const consumerInfo = new Map<string, { userId: string; consumerId: number }>();

type WsData = { id: string };

export class WebSocketServer {
  private worker: SyncWorkerManager | null = null;

  constructor() {}

  setWorker(worker: SyncWorkerManager) {
    this.worker = worker;
  }

  /**
   * Creates a WebSocket handler configuration for Bun.serve().
   */
  createHandler() {
    return {
      message: async (ws: BunWebSocket<WsData>, message: Buffer) => {
        try {
          const cmd = deserializeCommand(message);
          if (!cmd) {
            ws.send(serializeEvent({ type: EventType.ERROR, code: "E_INVALID" }));
            return;
          }
          const res = await this.handleMessage(cmd, ws);
          if (res instanceof CommandError) {
            ws.send(serializeEvent({ type: EventType.ERROR, code: res.code }));
          }
        } catch (error) {
          console.error("Failed to process WebSocket message:", error);
          ws.send(serializeEvent({ type: EventType.ERROR, code: "E_INVALID" }));
        }
      },
      open: (ws: BunWebSocket<WsData>) => {
        ws.data = { id: crypto.randomUUID() };
      },
      close: (ws: BunWebSocket<WsData>) => {
        const consumerKey = socketToConsumer.get(ws.data.id);
        if (!consumerKey) return;
        socketToConsumer.delete(ws.data.id);
        consumerToSocket.delete(consumerKey);

        const info = consumerInfo.get(consumerKey);
        if (info) {
          consumerInfo.delete(consumerKey);
          this.worker?.deactivateConsumer(info.userId, info.consumerId);
        }
      },
    };
  }

  private async handleMessage(cmd: Command, ws: BunWebSocket<WsData>) {
    switch (cmd.type) {
      case CommandType.CONNECT:
        return this.connect(cmd.key, ws);

      case CommandType.ACK: {
        const consumerKey = socketToConsumer.get(ws.data.id);
        if (!consumerKey) return new CommandError("E_ACCESS");
        const info = consumerInfo.get(consumerKey);
        if (!info) return new CommandError("E_ACCESS");
        console.log("ack", info.userId, info.consumerId, cmd.itemId);
        return this.ack(cmd.itemId);
      }

      default:
        console.warn("Unknown command type:", (cmd as { type: number }).type);
        return new CommandError("E_ACCESS");
    }
  }

  private async connect(key: Buffer, ws: BunWebSocket<WsData>) {
    const client = await authenticateConsumer(key);
    if (!client) return new CommandError("E_AUTH");
    if (socketToConsumer.has(ws.data.id)) return new CommandError("E_CONFLICT");

    const consumerKey = key.toString("hex");

    try {
      await this.worker?.activateConsumer(client.userId, client.id);
      consumerToSocket.set(consumerKey, ws);
      socketToConsumer.set(ws.data.id, consumerKey);
      consumerInfo.set(consumerKey, { userId: client.userId, consumerId: client.id });
      ws.send(serializeEvent({ type: EventType.CONNECTED }));
    } catch (error) {
      // Clean up maps if activation or send fails
      consumerToSocket.delete(consumerKey);
      socketToConsumer.delete(ws.data.id);
      consumerInfo.delete(consumerKey);
      console.error("Failed to connect consumer:", error);
      return new CommandError("E_ACCESS");
    }
  }

  private async ack(itemId: Buffer) {
    console.log("ack", itemId);
  }

  /**
   * Broadcasts items to connected consumers.
   */
  async broadcast(items: UserSyncItem[], connections: ConnectionInfo[]) {
    const collectionEvents = new Map<string, Exclude<ItemEvent, ListIdsEvent>[]>();

    for (const item of items) {
      const collectionKey = `${item.user}:${item.collection}`;
      const events = collectionEvents.get(collectionKey) ?? [];
      if (events.length === 0) collectionEvents.set(collectionKey, events);
      events.push(changedEvent(item));
    }

    for (const conn of connections) {
      // Find socket by looking up consumer info
      let socket: BunWebSocket<WsData> | undefined;
      for (const [key, info] of consumerInfo.entries()) {
        if (info.userId === conn.userId && info.consumerId === conn.consumerId) {
          socket = consumerToSocket.get(key);
          break;
        }
      }
      if (!socket) continue;

      const collectionKey = `${conn.userId}:${conn.collectionId}`;
      const events = collectionEvents.get(collectionKey);
      if (!events) continue;

      for (const event of events) {
        if (
          event.type === EventType.CHANGED &&
          conn.lastItemChanged != null &&
          event.item.changedAt < conn.lastItemChanged
        ) {
          continue;
        }
        socket.send(serializeEvent(event));
      }
    }
  }
}

export type ConnectionInfo = {
  userId: string;
  consumerId: number;
  collectionId: number;
  lastItemChanged: number | null;
};

function changedEvent(item: UserSyncItem): ChangedEvent {
  return { type: EventType.CHANGED, item };
}

async function authenticateConsumer(key: Buffer) {
  if (key.length !== 32) return null;
  const consumers = await db
    .select()
    .from(consumerTable)
    .where(eq(consumerTable.key, key))
    .limit(1)
    .all();
  return consumers[0] ?? null;
}

function deserializeCommand(buf: Buffer): Command | null {
  try {
    const arr = unpack(buf) as unknown[];
    if (!Array.isArray(arr) || arr.length < 1) return null;

    const type = arr[0] as CommandType;

    switch (type) {
      case CommandType.CONNECT: {
        if (arr.length < 2 || !(arr[1] instanceof Uint8Array)) return null;
        return {
          type,
          key: Buffer.from(arr[1]),
        } as ConnectCommand;
      }
      case CommandType.ACK: {
        if (arr.length < 2 || !(arr[1] instanceof Uint8Array)) return null;
        return {
          type,
          itemId: Buffer.from(arr[1]),
        } as AckCommand;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function serializeEvent(data: ItemEvent | ErrorEvent | ConnectedEvent): Buffer {
  let packed: unknown;
  switch (data.type) {
    case EventType.CONNECTED: {
      packed = pack([EventType.CONNECTED]);
      break;
    }
    case EventType.CHANGED: {
      const { item } = data;
      const contentArray =
        item.content && item.content.length > 0
          ? [item.ref, item.props, item.content]
          : [item.ref, item.props];
      packed = pack([
        EventType.CHANGED,
        item.collection,
        item.id,
        item.createdAt,
        item.changedAt,
        contentArray,
      ]);
      break;
    }
    case EventType.DELETED: {
      packed = pack([EventType.DELETED, data.item]);
      break;
    }
    case EventType.LIST_IDS: {
      packed = pack([EventType.LIST_IDS, data.collection, ...data.ids]);
      break;
    }
    case EventType.CHECKSUM: {
      packed = pack([EventType.CHECKSUM, data.collection, data.checksum]);
      break;
    }
    case EventType.ERROR: {
      packed = pack([EventType.ERROR, data.code]);
      break;
    }
  }
  return Buffer.from(packed as Uint8Array);
}
