import { connect, type NatsConnection } from "@nats-io/transport-node";
import { createLogger } from "../logger/index";

const log = createLogger("nats-connection");

let _nc: Promise<NatsConnection> | null = null;
const reconnectCallbacks: Array<() => void> = [];

const servers = process.env.NATS_SERVER?.split(",");

export function getNatsConnection(): Promise<NatsConnection> {
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
  }).then((nc) => {
    void monitorStatus(nc);
    return nc;
  }));
}

export function onNatsReconnect(cb: () => void): void {
  reconnectCallbacks.push(cb);
}

async function monitorStatus(nc: NatsConnection): Promise<void> {
  for await (const status of nc.status()) {
    if (status.type === "reconnect") {
      log.info({ server: status.server }, "NATS reconnected, invalidating caches");
      for (const cb of reconnectCallbacks) {
        cb();
      }
    }
  }
}
