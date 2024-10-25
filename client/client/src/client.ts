import {
  ChangedEvent,
  Command,
  CommandType,
  DeletedEvent,
  ErrorEvent,
  EventType,
  ItemEvent,
} from "@contfu/core";

type Opts = {
  WS?: typeof WebSocket;
  handle?: (e: ItemEvent) => Promise<void>;
};

export function connectTo<Props extends Record<string, Record<string, any>>>(
  key: Buffer,
  opts: Opts & { handle: (e: ItemEvent) => Promise<void> }
): void;
export function connectTo<Props extends Record<string, Record<string, any>>>(
  key: Buffer,
  opts?: Omit<Opts, "handle">
): AsyncGenerator<ItemEvent>;
export function connectTo(
  key: Buffer,
  { WS = global.WebSocket, handle }: Opts = {}
) {
  let resolve: (value: any) => void, reject: (reason?: any) => void;
  let socket = new WS("ws://localhost:9999");

  socket.onopen = () => {
    socket.send(serializeCommand({ type: CommandType.CONNECT, key }));
  };

  socket.onmessage = (event) => {
    const data = deserializeEvent(event.data as Buffer);
    resolve(data);
  };
  if (handle) {
    return (async () => {
      do {
        const event = await new Promise<ItemEvent>((res, rej) => {
          resolve = res;
          reject = rej;
        });
        if (
          event.type === EventType.CHANGED ||
          event.type === EventType.DELETED
        ) {
          await handle(event);
          socket.send(
            serializeCommand({
              type: CommandType.ACK,
              itemId:
                typeof event.item === "number" ? event.item : event.item.id,
              collectionId: event.collection,
            })
          );
        }
      } while (socket.readyState === WebSocket.OPEN);
    })();
  }
  return (async function* () {
    do {
      yield await new Promise<ItemEvent>((res, rej) => {
        resolve = res;
        reject = rej;
      });
    } while (socket.readyState === WebSocket.OPEN);
  })();
}

function serializeCommand(cmd: Command) {
  switch (cmd.type) {
    case CommandType.CONNECT: {
      const buf = Buffer.alloc(1 + cmd.key.length);
      buf.writeUInt8(cmd.type, 0);
      cmd.key.copy(buf, 1);
      return buf;
    }
    case CommandType.ACK: {
      const buf = Buffer.alloc(7);
      buf.writeUInt8(cmd.type, 0);
      buf.writeUInt16LE(cmd.collectionId, 1);
      buf.writeUInt32LE(cmd.itemId, 3);
      return buf;
    }
  }
}

function deserializeEvent(buf: Buffer) {
  const type = buf.readUInt8(0) as EventType;
  switch (type) {
    case EventType.ERROR: {
      const code = buf.subarray(4).toString("ascii");
      return { type, code } satisfies ErrorEvent;
    }
    case EventType.CHANGED: {
      const collection = buf.readUInt16LE(2);
      const id = buf.readUInt32LE(4);
      const createdAt = Number(buf.readBigInt64LE(8));
      const changedAt = Number(buf.readBigInt64LE(16));
      const propsJson = buf.subarray(24).toString("utf8");
      const props = JSON.parse(propsJson);
      return {
        type,
        collection,
        item: { id, createdAt, changedAt, collection, props },
      } satisfies ChangedEvent;
    }
    case EventType.DELETED: {
      const collection = buf.readUInt16LE(1);
      const item = buf.readUInt16LE(3);
      return { type, collection, item } satisfies DeletedEvent;
    }
  }
}
