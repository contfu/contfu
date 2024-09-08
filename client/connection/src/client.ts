import { ConnectionConfig, PageData, PageValidationError } from "@contfu/core";

type Opts = {
  WS?: typeof WebSocket | false;
  since?: number;
};

export async function* connect(
  connections: ConnectionConfig<string>[],
  { WS = global.WebSocket, since = undefined }: Opts = {}
) {
  yield* WS
    ? connectWs(connections, since, WS)
    : connectPoll(connections, since);
}

async function* connectWs(
  connections: ConnectionConfig<string>[],
  since?: number,
  ws = WebSocket
) {
  let resolve: (value: any) => void, reject: (reason?: any) => void;
  let socket = new ws("ws://localhost:8080/pages");

  socket.onopen = () => {
    socket.send(JSON.stringify({ connections, since }));
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data.toString());
    resolve(data);
  };

  while (socket.readyState === WebSocket.OPEN || WebSocket.CONNECTING) {
    yield new Promise<PageData | PageValidationError>((res, rej) => {
      resolve = res;
      reject = rej;
    });
  }
}

async function* connectPoll(
  connections: ConnectionConfig<string>[],
  since?: number
) {
  while (true) {
    const res = await fetch("http://localhost:8080/pages", {
      method: "POST",
      body: JSON.stringify({
        connections,
        since,
      }),
      headers: { "Content-Type": "application/json" },
    });
    yield (await res.json()) as PageData | PageValidationError;
  }
}

export function createConnection<C extends string>(
  connection: ConnectionConfig<C>
) {
  return connection;
}
