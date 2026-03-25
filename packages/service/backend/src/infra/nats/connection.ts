import { connect, type NatsConnection } from "@nats-io/transport-node";

let _nc: Promise<NatsConnection> | null = null;

const servers = process.env.NATS_SERVER?.split(",");

export async function getNatsConnection(): Promise<NatsConnection> {
  if (!servers) {
    throw new Error("NATS_SERVER environment variable not set");
  }
  return (_nc ??= connect({
    servers,
    timeout: 30000,
    verbose: true,
    reconnect: true,
    maxReconnectAttempts: -1,
    reconnectTimeWait: 1000,
    waitOnFirstConnect: true,
  }));
}
