CREATE TABLE `account` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`activeUntil` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_email_unique` ON `account` (`email`);--> statement-breakpoint
CREATE TABLE `consumer` (
	`accountId` integer NOT NULL,
	`id` integer NOT NULL,
	`key` blob,
	`name` text NOT NULL,
	`connectedTo` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`accountId`, `id`),
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `consumer_key_unique` ON `consumer` (`key`);--> statement-breakpoint
CREATE TABLE `quota` (
	`id` integer PRIMARY KEY NOT NULL,
	`sources` integer NOT NULL,
	`maxSources` integer NOT NULL,
	`collections` integer NOT NULL,
	`maxCollections` integer NOT NULL,
	`items` integer NOT NULL,
	`maxItems` integer NOT NULL,
	`clients` integer NOT NULL,
	`maxClients` integer NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `collection` (
	`accountId` integer NOT NULL,
	`sourceId` integer NOT NULL,
	`id` integer NOT NULL,
	`name` text NOT NULL,
	`ref` blob,
	`itemIds` blob,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	PRIMARY KEY(`accountId`, `id`),
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accountId`,`sourceId`) REFERENCES `source`(`accountId`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `connection` (
	`accountId` integer NOT NULL,
	`consumerId` integer NOT NULL,
	`collectionId` integer NOT NULL,
	`lastItemChanged` integer,
	`lastConsistencyCheck` integer,
	PRIMARY KEY(`accountId`, `consumerId`, `collectionId`),
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON   DELETE cascade,
	FOREIGN KEY (`accountId`,`consumerId`) REFERENCES `consumer`(`accountId`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accountId`,`collectionId`) REFERENCES `collection`(`accountId`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `item_id_conflict_resolution` (
	`accountId` integer NOT NULL,
	`collectionId` integer NOT NULL,
	`sourceItemId` blob NOT NULL,
	`id` integer NOT NULL,
	PRIMARY KEY(`accountId`, `collectionId`, `sourceItemId`),
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accountId`,`collectionId`) REFERENCES `collection`(`accountId`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `source` (
	`accountId` integer NOT NULL,
	`id` integer NOT NULL,
	`name` text,
	`url` text,
	`credentials` blob,
	`type` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	PRIMARY KEY(`accountId`, `id`),
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
