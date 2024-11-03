import {
  ChangedEvent,
  ChecksumEvent,
  Command,
  CommandType,
  ConnectedEvent,
  DeletedEvent,
  ErrorEvent,
  EventType,
  Item,
  ITEM_ID_SIZE,
  ItemEvent,
  ListIdsEvent,
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
      cmd.itemId.copy(buf, 1);
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
    case EventType.CHANGED: {
      const collection = buf.readUInt16LE(1);
      const uid = buf.subarray(3, 3 + ITEM_ID_SIZE);
      const createdAt = Number(buf.readBigInt64LE(3 + ITEM_ID_SIZE));
      const changedAt = Number(buf.readBigInt64LE(11 + ITEM_ID_SIZE));
      const json = buf.subarray(19 + ITEM_ID_SIZE).toString("utf8");
      const parsed = JSON.parse(json.trim());
      const [props, content] = Array.isArray(parsed) ? parsed : [parsed];
      const item = { id: uid, createdAt, changedAt, collection, props } as Item;
      if (content) item.content = content;
      return { type, item } as ChangedEvent;
    }
    case EventType.DELETED: {
      const item = buf.subarray(3);
      return { type, item } satisfies DeletedEvent;
    }
    case EventType.LIST_IDS: {
      const ids = [];
      const collection = buf.readUInt16LE(1);
      for (let i = 0; i < buf.length - 3; i += ITEM_ID_SIZE)
        ids.push(buf.subarray(3 + i, 3 + ITEM_ID_SIZE + i));
      return { type, collection, ids } satisfies ListIdsEvent;
    }
    case EventType.CHECKSUM: {
      const collection = buf.readUInt16LE(1);
      const checksum = buf.subarray(3);
      return { type, collection, checksum } satisfies ChecksumEvent;
    }
    case EventType.ERROR: {
      const code = buf.subarray(4).toString("ascii");
      return { type, code } satisfies ErrorEvent;
    }
  }
}
