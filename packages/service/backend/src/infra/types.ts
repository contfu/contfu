/**
 * Information about a connected consumer for broadcasting events.
 */
export type ConnectionInfo = {
  userId: number;
  connectionId: number;
  collectionId: number;
  includeRef: boolean;
};
