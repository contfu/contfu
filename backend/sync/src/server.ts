import {
  AckCommand,
  Command,
  CommandType,
  ConnectCommand,
  ConnectedEvent,
  ErrorEvent,
  EventType,
  ItemEvent,
  ListIdsEvent,
} from "@contfu/core";
import Elysia from "elysia";
import { ElysiaWS } from "elysia/ws";
import { pack, unpack } from "msgpackr";
import { bufferTime, concatMap, filter, Subscription } from "rxjs";
import { accessPlugin } from "./access/access-plugin";
import { authenticateConsumer } from "./access/access-repository";
import { changedEvent } from "./sync/events";
import {
  compressCollectionId,
  compressConsumerId,
  expandCollectionId,
  expandConsumerId,
} from "./sync/sync";
import { activateConsumer, getConnectionsToCollections, items$ } from "./sync/sync-service";

class CommandError extends Error {
  constructor(
    readonly code: "E_AUTH" | "E_CONFLICT" | "E_ACCESS",
    message?: string,
  ) {
    super(message);
  }
}

export const app = new Elysia()
  .use(accessPlugin({ prefix: "/api/access" }))
  .get("/", () => "This will be awesome!")
  .options("/health", () => {})
  .ws("/", {
    async message(ws, body) {
      const cmd = deserializeCommand(body as Buffer);
      const res = await handleWsMessage(cmd, ws);
      if (res instanceof CommandError) {
        ws.send(serializeEvent({ type: EventType.ERROR, code: res.code }));
      }
    },
    close(ws) {
      const ids = socketClients.get(ws.id);
      if (!ids) return;
      subs.get(ws.id)!.unsubscribe();
      subs.delete(ws.id);
      socketClients.delete(ws.id);
    },
  });

async function handleWsMessage(cmd: Command, ws: ElysiaWS<any, any>) {
  if (cmd.type === CommandType.CONNECT) {
    return connect(cmd.key, ws);
  }
  const consumerId = socketToConsumer.get(ws.id);
  if (!consumerId) return new CommandError("E_ACCESS");
  if (cmd.type === CommandType.ACK) {
    const [userId, id] = expandConsumerId(consumerId);
    console.log("ack", userId, id, cmd.itemId);

    return ack(cmd.itemId);
  }
}

async function connect(key: Buffer, ws: ElysiaWS<any, any>) {
  const client = await authenticateConsumer(key);
  if (!client) return new CommandError("E_AUTH");
  if (subs.has(ws.id)) return new CommandError("E_CONFLICT");
  await activateConsumer(client.userId, client.id);
  const consumerId = compressConsumerId(client.userId, client.id);
  consumerToSocket.set(consumerId, ws);
  socketToConsumer.set(ws.id, consumerId);
  ws.send(serializeEvent({ type: EventType.CONNECTED }));
}

async function ack(itemId: Buffer) {
  console.log("ack", itemId);
}

const consumerToSocket = new Map<number, ElysiaWS<any, any>>();
const socketToConsumer = new Map<string, number>();
const subs = new Map<string, Subscription>();
const socketClients = new Map<string, number[]>();

function deserializeCommand(buf: Buffer): Command {
  const arr = unpack(buf) as [CommandType, ...any[]];
  const type = arr[0];
  switch (type) {
    case CommandType.CONNECT: {
      return {
        type,
        key: Buffer.from(arr[1] as unknown as Uint8Array),
      } as ConnectCommand;
    }
    case CommandType.ACK: {
      return {
        type,
        itemId: Buffer.from(arr[1] as unknown as Uint8Array),
      } as AckCommand;
    }
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

export const processItems$ = items$.pipe(
  bufferTime(1000, undefined, 1000),
  filter((events) => events.length > 0),
  concatMap(async (items) => {
    const collectionIds = new Set<number>();
    const collectionEvents = new Map<number, Exclude<ItemEvent, ListIdsEvent>[]>();
    for (const item of items) {
      const collectionId = compressCollectionId(item.user, item.collection);
      collectionIds.add(collectionId);
      const events = collectionEvents.get(collectionId) ?? [];
      if (events.length === 0) collectionEvents.set(collectionId, events);
      events.push(changedEvent(item));
    }
    for (const conn of await getConnectionsToCollections(
      [...collectionIds].map((id) => expandCollectionId(id)),
    )) {
      const socket = consumerToSocket.get(compressConsumerId(conn.userId, conn.consumerId));
      if (!socket) continue;
      const collectionId = compressCollectionId(conn.userId, conn.collectionId);
      const events = collectionEvents.get(collectionId)!;
      for (const event of events) {
        if (
          event.type === EventType.CHANGED &&
          conn.lastItemChanged != null &&
          event.item.changedAt < conn.lastItemChanged
        )
          continue;
        socket.send(serializeEvent(event));
      }
    }
  }),
);
