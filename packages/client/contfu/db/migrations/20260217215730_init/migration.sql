CREATE TABLE `asset` (
	`id` blob PRIMARY KEY,
	`itemId` blob NOT NULL,
	`canonical` text NOT NULL UNIQUE,
	`originalUrl` text NOT NULL,
	`format` text NOT NULL,
	`size` integer NOT NULL,
	`createdAt` integer NOT NULL,
	CONSTRAINT `fk_asset_itemId_items_id_fk` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `collection` (
	`id` integer PRIMARY KEY,
	`ref` text NOT NULL UNIQUE,
	`name` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` blob PRIMARY KEY,
	`ref` text NOT NULL,
	`collection` integer NOT NULL,
	`props` text,
	`content` text,
	`changedAt` integer NOT NULL,
	CONSTRAINT `fk_items_collection_collection_id_fk` FOREIGN KEY (`collection`) REFERENCES `collection`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `links` (
	`type` text NOT NULL,
	`from` blob NOT NULL,
	`to` blob NOT NULL,
	CONSTRAINT `links_pk` PRIMARY KEY(`type`, `from`, `to`),
	CONSTRAINT `fk_links_from_items_id_fk` FOREIGN KEY (`from`) REFERENCES `items`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_links_to_items_id_fk` FOREIGN KEY (`to`) REFERENCES `items`(`id`) ON DELETE CASCADE
);
