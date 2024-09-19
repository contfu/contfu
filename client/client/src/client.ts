import {
  ChangedEvent,
  DeletedEvent,
  EventType,
  Item,
  ItemEvent,
  SourceConfig,
} from "@contfu/core";

type Opts = {
  WS?: typeof WebSocket;
  since?: number;
};

export async function* connectTo<
  Props extends Record<string, Record<string, any>>
>(
  sources: SourceConfig<keyof Props & string>[],
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
          [K in keyof Props & string]: Item<K, Props[K]>;
        }[keyof Props & string]
      >
    >((res, rej) => {
      resolve = res;
      reject = rej;
    });
  } while (socket.readyState === WebSocket.OPEN);
}

export function createSource<C extends string>(source: SourceConfig<C>) {
  return source;
}

function parseEvent(buf: Buffer) {
  const type = buf[0] as EventType;
  const id = buf.subarray(1, 17).toString("base64url");
  if (type === EventType.CHANGED) {
    const itemId = buf.subarray(17, 33).toString("base64url");
    const createdAt = Number(buf.readBigInt64BE(33));
    const changedAt = Number(buf.readBigInt64BE(41));
    const [collection, propsJson] = buf
      .subarray(49)
      .toString("utf8")
      .split("\u001C");
    const props = JSON.parse(propsJson);
    return {
      type,
      id,
      item: { id: itemId, src: id, createdAt, changedAt, collection, props },
    } as ChangedEvent;
  }
  if (type === EventType.LIST_IDS) {
    const collectionLength = buf.readUInt16BE(17);
    const collectionEnd = 19 + collectionLength;
    const collection = buf.subarray(19, collectionEnd).toString("utf8");
    const itemIds = [];
    for (let i = collectionEnd; i < buf.length; i += 16) {
      itemIds.push(buf.subarray(i, i + 16).toString("base64url"));
    }
    return {
      type,
      id,
      collection,
      itemIds,
    };
  }
  if (type === EventType.DELETED) {
    const itemId = buf.subarray(17, 33).toString("base64url");
    const collection = buf.subarray(33).toString("utf8");
    return {
      type,
      id,
      itemId,
      collection,
    } satisfies DeletedEvent;
  }
}
