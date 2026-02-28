import type { ItemChangedEvent, ItemDeletedEvent, ItemEvent } from "@contfu/core";
import { EventType } from "@contfu/core";

/**
 * Event handler function type compatible with @contfu/client's handle callback
 */
export type EventHandler = (event: ItemEvent) => Promise<void>;

/**
 * Options for registering event hooks.
 * Each hook is called when the corresponding event type is received.
 */
export interface HookOptions {
  /** Called when an item is created or updated */
  onChanged?: (event: ItemChangedEvent) => Promise<void>;
  /** Called when an item is deleted */
  onDeleted?: (event: ItemDeletedEvent) => Promise<void>;
}

/**
 * Creates an event handler function from hook options.
 * The returned handler can be passed to connectTo() from @contfu/client.
 *
 * @example
 * ```typescript
 * import { connectToSSE } from "@contfu/client";
 * import { createEventHandler } from "contfu";
 *
 * const handler = createEventHandler({
 *   onChanged: async (event) => {
 *     console.log("Item changed:", event.item.id);
 *     // Save to database...
 *   },
 *   onDeleted: async (event) => {
 *     console.log("Item deleted:", event.item);
 *     // Remove from database...
 *   },
 * });
 *
 * await connectToSSE(key, { url: "http://localhost:5173/api/sse", handle: handler });
 * ```
 */
export function createEventHandler(hooks: HookOptions): EventHandler {
  return async (event: ItemEvent): Promise<void> => {
    switch (event.type) {
      case EventType.ITEM_CHANGED:
        await hooks.onChanged?.(event);
        break;
      case EventType.ITEM_DELETED:
        await hooks.onDeleted?.(event);
        break;
    }
  };
}

/**
 * Composes multiple event handlers into a single handler.
 * All handlers are called in sequence for each event.
 *
 * @example
 * ```typescript
 * const loggingHandler = createEventHandler({
 *   onChanged: async (e) => console.log("Changed:", e.item.id),
 * });
 *
 * const persistenceHandler = createEventHandler({
 *   onChanged: async (e) => db.upsert(e.item),
 * });
 *
 * const handler = composeHandlers(loggingHandler, persistenceHandler);
 * await connectToSSE(key, { url: "http://localhost:5173/api/sse", handle: handler });
 * ```
 */
export function composeHandlers(...handlers: EventHandler[]): EventHandler {
  return async (event: ItemEvent): Promise<void> => {
    for (const handler of handlers) {
      await handler(event);
    }
  };
}
