import {
  Command,
  CommandType,
  ErrorEvent,
  EventType,
  ItemEvent,
} from "@contfu/core";
import Elysia from "elysia";
import { Subscription, isObservable } from "rxjs";
import { authenticateConsumer } from "./access/access-repository";
import { subscribeConsumerToCollections } from "./data/data-service";

class CommandError extends Error {
  constructor(readonly code: "E_AUTH" | "E_CONFLICT", message?: string) {
    super(message);
  }
}

export const app = new Elysia()
  .get("/", () => "This will be awesome!")
  .ws("/", {
    async message(ws, body) {
      const cmd = deserializeCommand(body as Buffer);
      const res = await handleWsMessage(cmd, ws.id);
      if (res instanceof CommandError) {
        ws.send(serializeEvent({ type: EventType.ERROR, code: res.code }));
      }
      if (isObservable(res)) {
        const sub = res.subscribe((data) =>
          ws.send(serializeEvent(data as any))
        );
        subs.set(ws.id, sub);
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

function handleWsMessage(cmd: Command, wsId: string) {
  switch (cmd.type) {
    case CommandType.CONNECT:
      return connect(cmd.key, wsId);
  }
}

async function connect(key: Buffer, wsId: string) {
  const client = await authenticateConsumer(key);
  if (!client) return new CommandError("E_AUTH");
  if (client.connectedTo != null || subs.has(wsId))
    return new CommandError("E_CONFLICT");
  console.debug("client connected", client.accountId, client.id);

  return subscribeConsumerToCollections(client);
}

const subs = new Map<string, Subscription>();
const socketClients = new Map<string, number[]>();

function deserializeCommand(buf: Buffer) {
  const type = buf.readUInt8(0) as CommandType;
  switch (type) {
    case CommandType.CONNECT: {
      return { type, key: buf.subarray(1) };
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
      buf.write(item.id, 4, "base64url");
      buf.writeBigInt64LE(BigInt(item.createdAt), 20);
      buf.writeBigInt64LE(BigInt(item.changedAt), 28);
      dynamicData.copy(buf, 36);
      return buf;
    }
    case EventType.DELETED: {
      const bufferLength = 4 + 16;
      const buf = Buffer.alloc(bufferLength);
      buf.writeUInt8(data.type, 0);
      buf.writeUInt8(data.src, 1);
      buf.writeUInt16LE(data.collection, 2);
      buf.writeUInt16LE(data.item, 4);
      return buf;
    }
    case EventType.ERROR: {
      const buf = Buffer.alloc(1 + data.code.length);
      buf.writeUInt8(data.type, 0);
      buf.write(data.code, 1, "ascii");
      console.log("error", data.code);

      return buf;
    }
  }
}
