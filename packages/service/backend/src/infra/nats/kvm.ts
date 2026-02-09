import { Kvm } from "@nats-io/kv";
import { getJetStreamManager } from "./jsm";

let _kvm: Promise<Kvm> | null = null;

export async function getKvManager(): Promise<Kvm> {
  return (_kvm ??= getJetStreamManager().then((jsm) => new Kvm(jsm.jetstream())));
}
