import { ConnectionConfig } from "@contfu/core";

export async function* connect(
  connections: ConnectionConfig<string>[],
  { ws = true, since = undefined }: { ws?: boolean; since?: number } = {}
) {
  yield* ws ? connectWs(connections, since) : connectPoll(connections, since);
}

async function* connectWs(
  connections: ConnectionConfig<string>[],
  since?: number
) {
  const socket = new WebSocket("ws://localhost:8080/pages");
  let resolve: (value: any) => void, reject: (reason?: any) => void;

  socket.onopen = () => {
    socket.send(JSON.stringify({ connections, since }));
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    resolve(data);
  };

  while (socket.readyState === WebSocket.OPEN || WebSocket.CONNECTING) {
    yield new Promise((res, rej) => {
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
    yield await res.json();
  }
}
