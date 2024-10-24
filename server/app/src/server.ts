import { AckCommand, Command, CommandType, ConnectCommand } from "@contfu/core";
import Elysia from "elysia";
import { ElysiaWS } from "elysia/ws";
import { Subscription, bufferTime, filter, from, tap } from "rxjs";
import { authenticateConsumer } from "./access/access-repository";
import { ErrorEvent, EventType, ItemEvent, ListIdsEvent } from "./sync/events";
import {
  compressCollectionId,
  compressConsumerId,
  expandCollectionId,
  expandConsumerId,
} from "./sync/sync";
import {
  activateConsumer,
  events,
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

processEvents();

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
  console.debug("client connected", client.accountId, client.id);

  await activateConsumer(client.accountId, client.id);
  const consumerId = compressConsumerId(client.accountId, client.id);
  consumerToSocket.set(consumerId, ws);
  socketToConsumer.set(ws.id, consumerId);
}

async function ack(itemId: number, collectionId: number) {
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
        itemId: buf.readUInt32LE(1),
        collectionId: buf.readUInt16LE(5),
      } as AckCommand;
    }
  }
}

function serializeEvent(data: ItemEvent | ErrorEvent) {
  console.log("serializeEvent", data);
  switch (data.type) {
    case EventType.CHANGED: {
      const { item } = data;
      const dynamicData = Buffer.from(JSON.stringify(item.props));
      const buf = Buffer.alloc(36 + dynamicData.length);
      buf.writeUInt8(data.type, 0);
      buf.writeUInt8(item.src, 1);
      buf.writeUInt16LE(item.collection, 2);
      buf.writeUInt32LE(item.id, 4);
      buf.writeBigInt64LE(BigInt(item.createdAt), 8);
      buf.writeBigInt64LE(BigInt(item.changedAt), 16);
      dynamicData.copy(buf, 24);
      return buf;
    }
    case EventType.DELETED: {
      const bufferLength = 4 + 16;
      const buf = Buffer.alloc(bufferLength);
      buf.writeUInt8(data.type, 0);
      buf.writeUInt16LE(data.collection, 1);
      buf.writeUInt16LE(data.item, 3);
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

function processEvents() {
  return from(events)
    .pipe(
      filter((event) => event.type !== EventType.LIST_IDS),
      tap(console.log),
      bufferTime(1500, undefined, 1000),
      filter((events) => events.length > 0)
    )
    .subscribe(async (events) => {
      console.log("processEvents", events);

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
    });
}

processEvents();
