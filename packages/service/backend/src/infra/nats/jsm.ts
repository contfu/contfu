import { jetstreamManager, type JetStreamManager } from "@nats-io/jetstream";
import { getNatsConnection } from "./connection";

let _jsm: Promise<JetStreamManager> | null = null;

export async function getJetStreamManager(): Promise<JetStreamManager> {
  return (_jsm ??= getNatsConnection().then(async (nc) => {
    while (true) {
      try {
        return await jetstreamManager(nc, { timeout: 3000 });
      } catch {
        console.debug("JetStream not ready, retrying...");
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }));
}
