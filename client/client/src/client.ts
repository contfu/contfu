import {
  ChangedEvent,
  Command,
  CommandType,
  ConnectedEvent,
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
): Promise<void>;
export function connectTo<Props extends Record<string, Record<string, any>>>(
  key: Buffer,
  opts?: Omit<Opts, "handle">
): Promise<AsyncGenerator<ItemEvent>>;
export async function connectTo(
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
  await new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

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
              itemId: event.item instanceof Buffer ? event.item : event.item.id,
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
      const buf = Buffer.alloc(11);
      buf.writeUInt8(cmd.type, 0);
      buf.writeUInt16LE(cmd.collectionId, 1);
      cmd.itemId.copy(buf, 3);
      return buf;
    }
  }
}

function deserializeEvent(buf: Buffer) {
  const type = buf.readUInt8(0) as EventType;
  switch (type) {
    case EventType.CONNECTED: {
      return { type } satisfies ConnectedEvent;
    }
    case EventType.ERROR: {
      const code = buf.subarray(4).toString("ascii");
      return { type, code } satisfies ErrorEvent;
    }
    case EventType.CHANGED: {
      const collection = buf.readUInt16LE(1);
      const id = buf.subarray(3, 15);
      const createdAt = Number(buf.readBigInt64LE(15));
      const changedAt = Number(buf.readBigInt64LE(23));
      const propsJson = buf.subarray(31).toString("utf8");
      const props = JSON.parse(propsJson.trim());
      return {
        type,
        collection,
        item: { id, createdAt, changedAt, collection, props },
      } satisfies ChangedEvent;
    }
    case EventType.DELETED: {
      const collection = buf.readUInt16LE(1);
      const item = buf.subarray(3);
      return { type, collection, item } satisfies DeletedEvent;
    }
  }
}
