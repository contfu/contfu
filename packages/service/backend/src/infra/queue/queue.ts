/**
 * Job types for contfu sync operations
 */
export enum JobType {
  SYNC_COLLECTION = 1, // Full sync of a collection
  SYNC_ITEM = 2, // Sync a single item
  REFRESH_TOKEN = 3, // Refresh OAuth token for a linked account
}

export interface SyncCollectionJob {
  type: JobType.SYNC_COLLECTION;
  userId: number;
  collectionId: number;
}

export interface SyncItemJob {
  type: JobType.SYNC_ITEM;
  userId: number;
  collectionId: number;
  itemId: string;
}

export interface RefreshTokenJob {
  type: JobType.REFRESH_TOKEN;
  userId: number;
  linkedAccountId: number;
}

export type Job = SyncCollectionJob | SyncItemJob | RefreshTokenJob;

export interface JobMessage {
  job: Job;
  ack: () => void;
  nack: () => void;
}

export interface Queue {
  push(job: Job): void;
  consume(): AsyncGenerator<JobMessage>;
  isScheduler(): AsyncGenerator<boolean>;
}
