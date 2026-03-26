import { Kvm } from "@nats-io/kv";
import { createLogger } from "../logger/index";
import { onNatsReconnect } from "./connection";
import { getJetStreamManager } from "./jsm";

const log = createLogger("nats-kvm");

let _kvm: Promise<Kvm> | null = null;

onNatsReconnect(() => {
  log.info("Invalidating cached KV manager after reconnect");
  _kvm = null;
});

export async function getKvManager(): Promise<Kvm> {
  return (_kvm ??= getJetStreamManager().then((jsm) => new Kvm(jsm.jetstream())));
}
