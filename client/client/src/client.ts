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
  since?: number;
};

export async function* connectTo<
  Props extends Record<string, Record<string, any>>
>(key: Buffer, { WS = global.WebSocket }: Opts = {}) {
  let resolve: (value: any) => void, reject: (reason?: any) => void;
  let socket = new WS("ws://localhost:9999");

  socket.onopen = () => {
    socket.send(serializeCommand({ type: CommandType.CONNECT, key }));
  };

  socket.onmessage = (event) => {
    const data = deserializeEvent(event.data as Buffer);
    resolve(data);
  };

  do {
    yield new Promise<ItemEvent>((res, rej) => {
      resolve = res;
      reject = rej;
    });
  } while (socket.readyState === WebSocket.OPEN);
}

function serializeCommand(cmd: Command) {
  switch (cmd.type) {
    case CommandType.CONNECT: {
      const buf = Buffer.alloc(1 + cmd.key.length);
      buf.writeUInt8(cmd.type, 0);
      cmd.key.copy(buf, 1);
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
      const src = buf.readUInt8(1);
      const collection = buf.readUInt16LE(2);
      const id = buf.subarray(4, 20).toString("base64url");
      const createdAt = Number(buf.readBigInt64LE(20));
      const changedAt = Number(buf.readBigInt64LE(28));
      const propsJson = buf.subarray(36).toString("utf8");
      const props = JSON.parse(propsJson);
      return {
        type,
        collection,
        item: { id, src, createdAt, changedAt, collection, props },
      } satisfies ChangedEvent;
    }
    case EventType.DELETED: {
      const collection = buf.readUInt16LE(1);
      const item = buf.readUInt16LE(3);
      return { type, collection, item } satisfies DeletedEvent;
    }
  }
}
