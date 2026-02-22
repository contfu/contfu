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
CREATE TABLE `items` (
	`id` blob PRIMARY KEY,
	`sourceType` integer,
	`ref` text,
	`collection` text NOT NULL,
	`props` blob,
	`content` blob,
	`changedAt` integer NOT NULL
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
--> statement-breakpoint
CREATE TABLE `sync` (
	`index` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_items_ref` ON `items` (`ref`);--> statement-breakpoint
CREATE INDEX `idx_items_collection` ON `items` (`collection`);--> statement-breakpoint
CREATE INDEX `idx_items_changedAt` ON `items` (`changedAt`);