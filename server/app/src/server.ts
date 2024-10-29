import { AckCommand, Command, CommandType, ConnectCommand } from "@contfu/core";
import Elysia from "elysia";
import { ElysiaWS } from "elysia/ws";
import { Subscription, bufferTime, concatMap, filter } from "rxjs";
import { authenticateConsumer } from "./access/access-repository";
import {
  ConnectedEvent,
  ErrorEvent,
  EventType,
  ItemEvent,
  ListIdsEvent,
} from "./sync/events";
import {
  compressCollectionId,
  compressConsumerId,
  expandCollectionId,
  expandConsumerId,
} from "./sync/sync";
import {
  activateConsumer,
  events$,
  getConnectionsToCollections,
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
    return ack(cmd.itemId, cmd.collectionId);
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

async function ack(itemId: Buffer, collectionId: number) {
  console.log("ack", itemId, collectionId);
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
      const dynamicData = Buffer.from(
        JSON.stringify(
          item.content && item.content.length > 0
            ? [item.props, item.content]
            : item.props
        ),
        "utf8"
      );
      const buf = Buffer.alloc(31 + dynamicData.length);
      buf.writeUInt8(data.type, 0);
      buf.writeUInt16LE(item.collection, 1);
      item.id.copy(buf, 3);
      buf.writeBigInt64LE(BigInt(item.createdAt), 15);
      buf.writeBigInt64LE(BigInt(item.changedAt), 23);
      dynamicData.copy(buf, 31);
      return buf;
    }
    case EventType.DELETED: {
      const bufferLength = 4 + 16;
      const buf = Buffer.alloc(bufferLength);
      buf.writeUInt8(data.type, 0);
      buf.writeUInt16LE(data.collection, 1);
      data.item.copy(buf, 3);
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

export const processEvents$ = events$.pipe(
  filter((event) => event.type !== EventType.LIST_IDS),
  bufferTime(1000, undefined, 1000),
  filter((events) => events.length > 0),
  concatMap(async (events) => {
    const collectionIds = new Set<number>();
    const collectionEvents = new Map<
      number,
      Exclude<ItemEvent, ListIdsEvent>[]
    >();
    for (const e of events) {
      const collectionId = compressCollectionId(e.account, e.collection);
      collectionIds.add(collectionId);
      const ces = collectionEvents.get(collectionId) ?? [];
      if (ces.length === 0) collectionEvents.set(collectionId, ces);
      ces.push(e);
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
      const ces = collectionEvents.get(collectionId)!;
      for (const event of ces) {
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
