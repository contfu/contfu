import { ConnectionConfig } from "@contfu/core";

export function connectPush(
  connections: ConnectionConfig<string>[],
  callback: (data: any) => void,
) {
  const socket = new WebSocket("ws://localhost:8080/pages");

  socket.onopen = () => {
    socket.send(JSON.stringify({ connections }));
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    callback(data);
  };
}
