import { Item, SourceConfig } from "@contfu/core";

type Opts = {
  WS?: typeof WebSocket | false;
  since?: number;
};

export async function* connectTo(
  sources: SourceConfig<string>[],
  { WS = global.WebSocket, since = undefined }: Opts = {}
) {
  yield* WS ? connectWs(sources, since, WS) : connectPoll(sources, since);
}

async function* connectWs(
  sources: SourceConfig<string>[],
  since?: number,
  ws = WebSocket
) {
  let resolve: (value: any) => void, reject: (reason?: any) => void;
  let socket = new ws("ws://localhost:3000/pages");

  socket.onopen = () => {
    socket.send(JSON.stringify({ sources, since }));
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data.toString());
    resolve(data);
  };

  do {
    yield new Promise<Item[]>((res, rej) => {
      resolve = res;
      reject = rej;
    });
  } while (socket.readyState === WebSocket.OPEN);
}

async function* connectPoll(sources: SourceConfig<string>[], since?: number) {
  while (true) {
    const res = await fetch("http://localhost:8080/pages", {
      method: "POST",
      body: JSON.stringify({ sources, since }),
      headers: { "Content-Type": "application/json" },
    });

    yield (await res.json()) as Item[];
  }
}

export function createSource<C extends string>(source: SourceConfig<C>) {
  return source;
}
