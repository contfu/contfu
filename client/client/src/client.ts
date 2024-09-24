import {
  ChangedEvent,
  DeletedEvent,
  EventType,
  Item,
  ItemEvent,
  ListIdsEvent,
  SourceConfig,
} from "@contfu/core";

type Opts = {
  WS?: typeof WebSocket;
  since?: number;
};

export async function* connectTo<
  Props extends Record<string, Record<string, any>>
>(
  sources: SourceConfig[],
  { WS = global.WebSocket, since = undefined }: Opts = {}
) {
  let resolve: (value: any) => void, reject: (reason?: any) => void;
  let socket = new WS("ws://localhost:9999/pages");

  socket.onopen = () => {
    socket.send(JSON.stringify({ sources, since }));
  };

  socket.onmessage = (event) => {
    const data = parseEvent(event.data as Buffer);
    resolve(data);
  };

  do {
    yield new Promise<
      ItemEvent<
        {
          [K in keyof Props & string]: Item<Props[K]>;
        }[keyof Props & string]
      >
    >((res, rej) => {
      resolve = res;
      reject = rej;
    });
  } while (socket.readyState === WebSocket.OPEN);
}

export function createSource(source: SourceConfig) {
  return source;
}

function parseEvent(buf: Buffer) {
  const type = buf.readUInt8(0) as EventType;
  const src = buf.readUInt8(1);
  const collection = buf.readUInt16LE(2);
  switch (type) {
    case EventType.CHANGED: {
      const id = buf.subarray(4, 20).toString("base64url");
      const createdAt = Number(buf.readBigInt64LE(20));
      const changedAt = Number(buf.readBigInt64LE(28));
      const propsJson = buf.subarray(36).toString("utf8");
      const props = JSON.parse(propsJson);
      return {
        type,
        src,
        collection,
        item: { id, src, createdAt, changedAt, collection, props },
      } satisfies ChangedEvent;
    }
    case EventType.LIST_IDS: {
      const count = (buf.length - 4) / 16;
      const ids = new Array(count);
      for (let i = 0; i < count; i++) {
        const idx = i * 16 + 4;
        ids[i] = buf.subarray(idx, idx + 16).toString("base64url");
      }
      return {
        type,
        src,
        collection,
        ids,
      } satisfies ListIdsEvent;
    }
    case EventType.DELETED: {
      const item = buf.subarray(4).toString("base64url");
      return {
        type,
        src,
        collection,
        item,
      } satisfies DeletedEvent;
    }
  }
}
