CREATE TABLE `collection` (
	`userId` integer NOT NULL,
	`sourceId` integer NOT NULL,
	`id` integer NOT NULL,
	`name` text NOT NULL,
	`ref` BLOB,
	`itemIds` BLOB,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	PRIMARY KEY(`userId`, `id`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`,`sourceId`) REFERENCES `source`(`userId`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `connection` (
	`userId` integer NOT NULL,
	`consumerId` integer NOT NULL,
	`collectionId` integer NOT NULL,
	`lastItemChanged` integer,
	`lastConsistencyCheck` integer,
	PRIMARY KEY(`userId`, `consumerId`, `collectionId`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`,`consumerId`) REFERENCES `consumer`(`userId`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`,`collectionId`) REFERENCES `collection`(`userId`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `consumer` (
	`userId` integer NOT NULL,
	`id` integer NOT NULL,
	`key` BLOB,
	`name` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`userId`, `id`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `consumer_key_unique` ON `consumer` (`key`);--> statement-breakpoint
CREATE TABLE `item_id_conflict_resolution` (
	`userId` integer NOT NULL,
	`collectionId` integer NOT NULL,
	`sourceItemId` BLOB NOT NULL,
	`id` integer NOT NULL,
	PRIMARY KEY(`userId`, `collectionId`, `sourceItemId`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`,`collectionId`) REFERENCES `collection`(`userId`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
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
	FOREIGN KEY (`id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` blob PRIMARY KEY NOT NULL,
	`userId` integer NOT NULL,
	`expiresAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `source` (
	`userId` integer NOT NULL,
	`id` integer NOT NULL,
	`name` text,
	`url` text,
	`credentials` BLOB,
	`type` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	PRIMARY KEY(`userId`, `id`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`avatar` blob,
	`activeUntil` integer,
	`password` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);