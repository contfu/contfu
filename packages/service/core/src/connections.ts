/**
 * A connection between a consumer and a collection (service layer).
 * Uses encoded string IDs for API exposure.
 */
export interface ServiceConnection {
  userId: string;
  consumerId: string;
  collectionId: string;
  lastItemChanged: Date | null;
  lastConsistencyCheck: Date | null;
}

/**
 * A connection with resolved consumer and collection names.
 */
export interface ServiceConnectionWithDetails extends ServiceConnection {
  consumerName: string;
  collectionName: string;
}
