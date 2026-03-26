import { jetstreamManager, type JetStreamManager } from "@nats-io/jetstream";
import { createLogger } from "../logger/index";
import { getNatsConnection, onNatsReconnect } from "./connection";

const log = createLogger("nats-jsm");

let _jsm: Promise<JetStreamManager> | null = null;

const MAX_WAIT_MS = 30000;
const RETRY_DELAY_MS = 500;

onNatsReconnect(() => {
  log.info("Invalidating cached JetStream manager after reconnect");
  _jsm = null;
});

export async function getJetStreamManager(): Promise<JetStreamManager> {
  return (_jsm ??= getNatsConnection().then(async (nc) => {
    const startTime = Date.now();
    while (true) {
      try {
        return await jetstreamManager(nc, { timeout: 3000 });
      } catch (err) {
        const elapsed = Date.now() - startTime;
        if (elapsed >= MAX_WAIT_MS) {
          throw new Error(
            `JetStream initialization failed after ${MAX_WAIT_MS}ms: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        log.debug({ elapsed }, "JetStream not ready, retrying");
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }));
}
