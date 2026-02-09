import { jetstreamManager, type JetStreamManager } from "@nats-io/jetstream";
import { getNatsConnection } from "./connection";

let _jsm: JetStreamManager | null = null;

export async function getJetStreamManager(): Promise<JetStreamManager> {
  if (_jsm) return _jsm;

  const nc = await getNatsConnection();

  // Retry until JetStream is ready
  while (true) {
    try {
      _jsm = await jetstreamManager(nc, { timeout: 3000 });
      return _jsm;
    } catch {
      console.debug("JetStream not ready, retrying...");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}
