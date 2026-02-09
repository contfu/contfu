import { Kvm } from "@nats-io/kv";
import { getJetStreamManager } from "./jsm";

let _kvm: Kvm | null = null;

export async function getKvManager(): Promise<Kvm> {
  if (_kvm) return _kvm;

  const jsm = await getJetStreamManager();
  _kvm = new Kvm(jsm.jetstream());
  return _kvm;
}
