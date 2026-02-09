import type { WireItemEvent } from "@contfu/core";
import { pack, unpack } from "msgpackr";
import { getNatsConnection, hasNats } from "./connection";

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
  if (!hasNats()) return;

  const nc = await getNatsConnection();
  nc.publish(ITEM_EVENTS_SUBJECT, pack(event));
}

/**
 * Subscribe to item events
 * Returns an unsubscribe function
 */
export async function subscribeToItemEvents(
  handler: (event: NatsItemEvent) => void | Promise<void>,
): Promise<() => void> {
  if (!hasNats()) {
    // No-op in local mode
    return () => {};
  }

  const nc = await getNatsConnection();
  const sub = nc.subscribe(ITEM_EVENTS_SUBJECT);

  // Process messages asynchronously
  (async () => {
    for await (const msg of sub) {
      try {
        const event = unpack(msg.data) as NatsItemEvent;
        await handler(event);
      } catch (error) {
        console.error("Error processing item event:", error);
      }
    }
  })();

  return () => {
    sub.unsubscribe();
  };
}

/**
 * Subscribe to item events for a specific user
 */
export async function subscribeToUserItemEvents(
  userId: number,
  handler: (event: NatsItemEvent) => void,
): Promise<() => void> {
  return subscribeToItemEvents((event) => {
    if (event[0] === userId) {
      handler(event);
    }
  });
}
