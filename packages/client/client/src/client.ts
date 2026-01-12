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
  ItemEvent,
  ListIdsEvent
} from "@contfu/core";
import { pack, unpack } from "msgpackr";

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
    const data = event.data;
    const deserialized = deserializeEvent(data as Buffer);
    resolve(deserialized);
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

function serializeCommand(cmd: Command): Buffer {
  let packed: unknown;
  switch (cmd.type) {
    case CommandType.CONNECT: {
      packed = pack([CommandType.CONNECT, cmd.key] as any);
      break;
    }
    case CommandType.ACK: {
      packed = pack([CommandType.ACK, cmd.itemId] as any);
      break;
    }
  }
  return Buffer.from(packed as Uint8Array);
}

function deserializeEvent(buf: Buffer): ItemEvent | ErrorEvent | ConnectedEvent {
  const arr = unpack(buf) as [EventType, ...any[]];
  const type = arr[0];
  switch (type) {
    case EventType.CONNECTED: {
      return { type } satisfies ConnectedEvent;
    }
    case EventType.CHANGED: {
      const [, collection, id, createdAt, changedAt, contentArray] = arr;
      const [ref, props, content] = contentArray as [
        Uint8Array | Buffer | number[],
        any,
        any?,
      ];
      const item = {
        id: Buffer.from(id as unknown as Uint8Array),
        ref: Buffer.from(ref as unknown as Uint8Array),
        createdAt,
        changedAt,
        collection,
        props,
      } as Item;
      if (content) item.content = content;
      return { type, item } as ChangedEvent;
    }
    case EventType.DELETED: {
      return {
        type,
        item: Buffer.from(arr[1] as unknown as Uint8Array),
      } satisfies DeletedEvent;
    }
    case EventType.LIST_IDS: {
      const [, collection, ...ids] = arr;
      return {
        type,
        collection,
        ids: ids.map((id) => Buffer.from(id as unknown as Uint8Array)),
      } satisfies ListIdsEvent;
    }
    case EventType.CHECKSUM: {
      const [, collection, checksum] = arr;
      return {
        type,
        collection,
        checksum: Buffer.from(checksum as unknown as Uint8Array),
      } satisfies ChecksumEvent;
    }
    case EventType.ERROR: {
      return { type, code: arr[1] } satisfies ErrorEvent;
    }
  }
}
