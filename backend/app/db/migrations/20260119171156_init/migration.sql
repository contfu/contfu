CREATE TABLE `account` (
	`id` text PRIMARY KEY,
	`userId` text NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`idToken` text,
	`password` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	CONSTRAINT `fk_account_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `collection` (
	`userId` text NOT NULL,
	`sourceId` integer NOT NULL,
	`id` integer NOT NULL,
	`name` text NOT NULL,
	`ref` blob,
	`itemIds` blob,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	CONSTRAINT `collection_pk` PRIMARY KEY(`userId`, `id`),
	CONSTRAINT `fk_collection_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_collection_userId_sourceId_source_userId_id_fk` FOREIGN KEY (`userId`,`sourceId`) REFERENCES `source`(`userId`,`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `connection` (
	`userId` text NOT NULL,
	`consumerId` integer NOT NULL,
	`collectionId` integer NOT NULL,
	`lastItemChanged` integer,
	`lastConsistencyCheck` integer,
	CONSTRAINT `connection_pk` PRIMARY KEY(`userId`, `consumerId`, `collectionId`),
	CONSTRAINT `fk_connection_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_connection_userId_consumerId_consumer_userId_id_fk` FOREIGN KEY (`userId`,`consumerId`) REFERENCES `consumer`(`userId`,`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_connection_userId_collectionId_collection_userId_id_fk` FOREIGN KEY (`userId`,`collectionId`) REFERENCES `collection`(`userId`,`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `consumer` (
	`userId` text NOT NULL,
	`id` integer NOT NULL,
	`key` blob UNIQUE,
	`name` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `consumer_pk` PRIMARY KEY(`userId`, `id`),
	CONSTRAINT `fk_consumer_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `item_id_conflict_resolution` (
	`userId` text NOT NULL,
	`collectionId` integer NOT NULL,
	`sourceItemId` blob NOT NULL,
	`id` integer NOT NULL,
	CONSTRAINT `item_id_conflict_resolution_pk` PRIMARY KEY(`userId`, `collectionId`, `sourceItemId`),
	CONSTRAINT `fk_item_id_conflict_resolution_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_item_id_conflict_resolution_userId_collectionId_collection_userId_id_fk` FOREIGN KEY (`userId`,`collectionId`) REFERENCES `collection`(`userId`,`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `quota` (
	`id` text PRIMARY KEY,
	`polarCustomerId` text,
	`subscriptionId` text,
	`subscriptionStatus` text,
	`currentPeriodEnd` integer,
	`sources` integer DEFAULT 0 NOT NULL,
	`maxSources` integer NOT NULL,
	`collections` integer DEFAULT 0 NOT NULL,
	`maxCollections` integer NOT NULL,
	`items` integer DEFAULT 0 NOT NULL,
	`maxItems` integer NOT NULL,
	`consumers` integer DEFAULT 0 NOT NULL,
	`maxConsumers` integer NOT NULL,
	CONSTRAINT `fk_quota_id_user_id_fk` FOREIGN KEY (`id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY,
	`userId` text NOT NULL,
	`token` text NOT NULL UNIQUE,
	`expiresAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	CONSTRAINT `fk_session_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `source` (
	`userId` text NOT NULL,
	`id` integer NOT NULL,
	`name` text,
	`url` text,
	`credentials` blob,
	`type` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	CONSTRAINT `source_pk` PRIMARY KEY(`userId`, `id`),
	CONSTRAINT `fk_source_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY,
	`email` text NOT NULL UNIQUE,
	`name` text NOT NULL,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer
);
