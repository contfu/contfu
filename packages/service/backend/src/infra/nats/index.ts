export { getNatsConnection, hasNats } from "./connection";
export {
  ensureEventStream,
  getLastSequence,
  isSequenceAvailable,
  publishEvent,
  replayEvents,
} from "./event-stream";
export { getJetStreamManager } from "./jsm";
export { getKvManager } from "./kvm";
export { isLeader, raceForLeader } from "./leader-election";
export { publishItemEvent, subscribeToItemEvents, type NatsItemEvent } from "./item-events";
export {
  getQuota,
  ensureQuota,
  setLimits,
  incrementCount,
  decrementCount,
  addItems,
  checkQuota,
  isItemQuotaExceeded,
  getQuotaPeriodEnd,
  type QuotaState,
} from "./quota-kv";
