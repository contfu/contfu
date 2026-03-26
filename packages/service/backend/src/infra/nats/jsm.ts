import { jetstreamManager, type JetStreamManager } from "@nats-io/jetstream";
import { createLogger } from "../logger/index";
import { getNatsConnection, onNatsReconnect } from "./connection";

const log = createLogger("nats-jsm");

let _jsm: Promise<JetStreamManager> | null = null;

const MAX_WAIT_MS = 30000;
const INITIAL_RETRY_MS = 100;
const MAX_RETRY_MS = 5000;

onNatsReconnect(() => {
  log.info("Invalidating cached JetStream manager after reconnect");
  _jsm = null;
});

export async function getJetStreamManager(): Promise<JetStreamManager> {
  return (_jsm ??= getNatsConnection().then(async (nc) => {
    const startTime = Date.now();
    let attempt = 0;
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
        const delay = Math.random() * Math.min(MAX_RETRY_MS, INITIAL_RETRY_MS * 2 ** attempt);
        log.debug({ elapsed, delay }, "JetStream not ready, retrying");
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt++;
      }
    }
  }));
}
