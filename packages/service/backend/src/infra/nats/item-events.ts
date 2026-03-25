import type { WireItemEvent } from "@contfu/core";
import { pack, unpack } from "msgpackr";
import { createLogger } from "../logger/index";
import { getNatsConnection } from "./connection";

const log = createLogger("nats-item-events");

/**
 * Item events are distributed via NATS core pub/sub for low latency.
 * These are ephemeral events (no persistence needed) since they're just
 * for notifying connected clients about changes.
 *
 * Uses msgpackr with tuple format for minimal encoding size.
 * Reuses WireItemEvent from core, prefixed with userId for routing.
 */

/** NATS item event: userId prefix + WireItemEvent tuple. */
export type NatsItemEvent = [number, ...WireItemEvent];

const ITEM_EVENTS_SUBJECT = "i";

/**
 * Publish an item event to all subscribers
 */
export async function publishItemEvent(event: NatsItemEvent): Promise<void> {
  const nc = await getNatsConnection();
  nc.publish(ITEM_EVENTS_SUBJECT, pack(event));
}

/**
 * Subscribe to item events as an async generator.
 * Use a map from userId to connections for efficient routing.
 */
export async function* subscribeToItemEvents(): AsyncGenerator<NatsItemEvent, void, void> {
  const nc = await getNatsConnection();
  const sub = nc.subscribe(ITEM_EVENTS_SUBJECT);

  try {
    for await (const msg of sub) {
      try {
        yield unpack(msg.data) as NatsItemEvent;
      } catch (error) {
        log.error({ err: error }, "Error parsing item event");
      }
    }
  } finally {
    sub.unsubscribe();
  }
}
