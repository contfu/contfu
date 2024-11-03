import {
  AckCommand,
  Command,
  CommandType,
  ConnectCommand,
  ConnectedEvent,
  ErrorEvent,
  EventType,
  ITEM_ID_SIZE,
  ItemEvent,
  ListIdsEvent,
} from "@contfu/core";
import Elysia from "elysia";
import { ElysiaWS } from "elysia/ws";
import { bufferTime, concatMap, filter, Subscription } from "rxjs";
import { authenticateConsumer } from "./access/access-repository";
import { changedEvent } from "./sync/events";
import {
  compressCollectionId,
  compressConsumerId,
  expandCollectionId,
  expandConsumerId,
} from "./sync/sync";
import {
  activateConsumer,
  getConnectionsToCollections,
  items$,
} from "./sync/sync-service";

class CommandError extends Error {
  constructor(
    readonly code: "E_AUTH" | "E_CONFLICT" | "E_ACCESS",
    message?: string
  ) {
    super(message);
  }
}

export const app = new Elysia()
  .get("/", () => "This will be awesome!")
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
    const [accountId, id] = expandConsumerId(consumerId);
    return ack(cmd.itemId);
  }
}

async function connect(key: Buffer, ws: ElysiaWS<any, any>) {
  const client = await authenticateConsumer(key);
  if (!client) return new CommandError("E_AUTH");
  if (subs.has(ws.id)) return new CommandError("E_CONFLICT");
  await activateConsumer(client.accountId, client.id);
  const consumerId = compressConsumerId(client.accountId, client.id);
  consumerToSocket.set(consumerId, ws);
  socketToConsumer.set(ws.id, consumerId);
  ws.send(serializeEvent({ type: EventType.CONNECTED }));
}

async function ack(itemId: Buffer) {
  console.log("ack", itemId);
}

const consumerToSocket = new Map<number, ElysiaWS<any, any>>();
const socketToConsumer = new Map<string, number>();
const sockets = new Map<string, ElysiaWS<any, any>>();
const subs = new Map<string, Subscription>();
const socketClients = new Map<string, number[]>();

function deserializeCommand(buf: Buffer) {
  const type = buf.readUInt8(0) as CommandType;
  switch (type) {
    case CommandType.CONNECT: {
      return { type, key: buf.subarray(1) } as ConnectCommand;
    }
    case CommandType.ACK: {
      return {
        type,
        itemId: buf.subarray(1, 13),
        collectionId: buf.readUInt16LE(13),
      } as AckCommand;
    }
  }
}

function serializeEvent(data: ItemEvent | ErrorEvent | ConnectedEvent) {
  switch (data.type) {
    case EventType.CONNECTED: {
      const buf = Buffer.alloc(1);
      buf.writeUInt8(data.type, 0);
      return buf;
    }
    case EventType.CHANGED: {
      const { item } = data;
      const jsonBuf = Buffer.from(
        JSON.stringify(
          item.content && item.content.length > 0
            ? [item.ref, item.props, item.content]
            : [item.ref, item.props]
        ),
        "utf8"
      );
      const buf = Buffer.alloc(19 + ITEM_ID_SIZE + jsonBuf.length);
      buf.writeUInt8(data.type, 0);
      buf.writeUInt16LE(item.collection, 1);
      item.id.copy(buf, 3);
      buf.writeBigInt64LE(BigInt(item.createdAt), 3 + ITEM_ID_SIZE);
      buf.writeBigInt64LE(BigInt(item.changedAt), 11 + ITEM_ID_SIZE);
      jsonBuf.copy(buf, 19 + ITEM_ID_SIZE);
      return buf;
    }
    case EventType.DELETED: {
      const bufferLength = 4 + ITEM_ID_SIZE;
      const buf = Buffer.alloc(bufferLength);
      buf.writeUInt8(data.type, 0);
      data.item.copy(buf, 1);
      return buf;
    }
    case EventType.LIST_IDS: {
      const buf = Buffer.alloc(3 + data.ids.length * ITEM_ID_SIZE);
      buf.writeUInt8(data.type, 0);
      buf.writeUInt16LE(data.collection, 1);
      for (let i = 0; i < data.ids.length; i++)
        data.ids[i].copy(buf, 3 + i * ITEM_ID_SIZE);
      return buf;
    }
    case EventType.CHECKSUM: {
      const buf = Buffer.alloc(3 + data.checksum.length);
      buf.writeUInt8(data.type, 0);
      buf.writeUInt16LE(data.collection, 1);
      data.checksum.copy(buf, 3);
      return buf;
    }
    case EventType.ERROR: {
      const buf = Buffer.alloc(1 + data.code.length);
      buf.writeUInt8(data.type, 0);
      buf.write(data.code, 1, "ascii");
      return buf;
    }
  }
}

export const processItems$ = items$.pipe(
  bufferTime(1000, undefined, 1000),
  filter((events) => events.length > 0),
  concatMap(async (items) => {
    const collectionIds = new Set<number>();
    const collectionEvents = new Map<
      number,
      Exclude<ItemEvent, ListIdsEvent>[]
    >();
    for (const item of items) {
      const collectionId = compressCollectionId(item.account, item.collection);
      collectionIds.add(collectionId);
      const events = collectionEvents.get(collectionId) ?? [];
      if (events.length === 0) collectionEvents.set(collectionId, events);
      events.push(changedEvent(item));
    }
    for (const conn of await getConnectionsToCollections(
      [...collectionIds].map((id) => expandCollectionId(id))
    )) {
      const socket = consumerToSocket.get(
        compressConsumerId(conn.accountId, conn.consumerId)
      );
      if (!socket) continue;
      const collectionId = compressCollectionId(
        conn.accountId,
        conn.collectionId
      );
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
  })
);
