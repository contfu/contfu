import { Item, ItemEvent, SourceConfig } from "@contfu/core";

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
  let socket = new WS("ws://localhost:3000/pages");

  socket.onopen = () => {
    socket.send(JSON.stringify({ sources, since }));
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data.toString());
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
