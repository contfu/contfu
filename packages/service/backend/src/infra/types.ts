/**
 * Information about a connected consumer for broadcasting events.
 */
export type ConnectionInfo = {
  userId: number;
  consumerId: number;
  collectionId: number;
  includeRef: boolean;
  lastItemChanged: Date | null;
};
