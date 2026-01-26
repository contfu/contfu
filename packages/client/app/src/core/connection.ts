/**
 * Configuration for a push connection.
 */
export interface ConnectionConfig<C extends string = string> {
  id: string;
  collectionNames: C[];
}

export function connectPush(
  connections: ConnectionConfig<string>[],
  callback: (data: unknown) => void,
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
