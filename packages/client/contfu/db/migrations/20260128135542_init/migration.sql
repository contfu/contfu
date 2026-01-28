CREATE TABLE `asset` (
	`id` blob PRIMARY KEY,
	`pageId` blob NOT NULL,
	`canonical` text NOT NULL UNIQUE,
	`originalUrl` text NOT NULL,
	`format` text NOT NULL,
	`size` integer NOT NULL,
	`createdAt` integer NOT NULL,
	CONSTRAINT `fk_asset_pageId_items_id_fk` FOREIGN KEY (`pageId`) REFERENCES `items`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `collection` (
	`id` integer PRIMARY KEY,
	`name` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` blob PRIMARY KEY,
	`ref` text NOT NULL,
	`path` text NOT NULL UNIQUE,
	`collection` integer NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`content` text,
	`props` text,
	`author` text,
	`connection` blob NOT NULL,
	`publishedAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer,
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
