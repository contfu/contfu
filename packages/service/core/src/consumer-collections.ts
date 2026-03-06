/**
 * A consumer-collection join (service layer).
 * Uses encoded string IDs for API exposure.
 */
export interface ServiceConsumerCollection {
  userId: string;
  consumerId: string;
  collectionId: string;
  includeRef: boolean;
  lastItemChanged: Date | null;
  lastConsistencyCheck: Date | null;
}

/**
 * A consumer-collection join with resolved consumer and collection names.
 */
export interface ServiceConsumerCollectionWithDetails extends ServiceConsumerCollection {
  consumerName: string;
  collectionName: string;
}
