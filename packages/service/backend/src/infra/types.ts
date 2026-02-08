/**
 * Information about a connected consumer for broadcasting events.
 * Used by all transport layers (WebSocket, Stream).
 */
export type ConnectionInfo = {
  userId: number;
  consumerId: number;
  collectionId: number;
  lastItemChanged: number | null;
};
