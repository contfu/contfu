import { connect, type NatsConnection } from "@nats-io/transport-node";

let _nc: NatsConnection | null = null;

const servers = process.env.NATS_SERVER?.split(",");

export async function getNatsConnection(): Promise<NatsConnection> {
  if (_nc) return _nc;

  if (!servers) {
    throw new Error("NATS_SERVER environment variable not set");
  }

  _nc = await connect({
    servers,
    timeout: 30000,
    verbose: true,
    reconnect: true,
    maxReconnectAttempts: -1,
    reconnectTimeWait: 1000,
    waitOnFirstConnect: true,
  });

  return _nc;
}

export function hasNats(): boolean {
  return !!process.env.NATS_SERVER;
}
