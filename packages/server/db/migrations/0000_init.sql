CREATE TABLE `collection` (
	`userId` integer NOT NULL,
	`sourceId` integer NOT NULL,
	`id` integer NOT NULL,
	`name` text NOT NULL,
	`ref` blob,
	`itemIds` blob,
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
	`key` blob,
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
	`sourceItemId` blob NOT NULL,
	`id` integer NOT NULL,
	PRIMARY KEY(`userId`, `collectionId`, `sourceItemId`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`,`collectionId`) REFERENCES `collection`(`userId`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quota` (
	`id` integer PRIMARY KEY NOT NULL,
	`sources` integer DEFAULT 0 NOT NULL,
	`maxSources` integer NOT NULL,
	`collections` integer DEFAULT 0 NOT NULL,
	`maxCollections` integer NOT NULL,
	`items` integer DEFAULT 0 NOT NULL,
	`maxItems` integer NOT NULL,
	`consumers` integer DEFAULT 0 NOT NULL,
	`maxConsumers` integer NOT NULL,
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
	`credentials` blob,
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
	`activationToken` blob,
	`activeUntil` integer,
	`password` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);