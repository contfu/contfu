import { getNatsConnection, hasNats } from "./connection";

/**
 * Item events are distributed via NATS core pub/sub for low latency.
 * These are ephemeral events (no persistence needed) since they're just
 * for notifying connected clients about changes.
 */

export interface ItemEvent {
  userId: number;
  collectionId: number;
  itemId: string;
  action: "created" | "updated" | "deleted";
}

const ITEM_EVENTS_SUBJECT = "i";

/**
 * Publish an item event to all subscribers
 */
export async function publishItemEvent(event: ItemEvent): Promise<void> {
  if (!hasNats()) return;

  const nc = await getNatsConnection();
  const payload = JSON.stringify(event);
  nc.publish(ITEM_EVENTS_SUBJECT, Buffer.from(payload));
}

/**
 * Subscribe to item events
 * Returns an unsubscribe function
 */
export async function subscribeToItemEvents(
  handler: (event: ItemEvent) => void,
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
        const event = JSON.parse(Buffer.from(msg.data).toString("utf8")) as ItemEvent;
        handler(event);
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
  handler: (event: ItemEvent) => void,
): Promise<() => void> {
  return subscribeToItemEvents((event) => {
    if (event.userId === userId) {
      handler(event);
    }
  });
}
