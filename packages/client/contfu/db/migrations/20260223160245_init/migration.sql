CREATE TABLE `asset` (
	`id` blob PRIMARY KEY,
	`originalUrl` text NOT NULL,
	`mediaType` text NOT NULL,
	`ext` text NOT NULL,
	`size` integer NOT NULL,
	`data` blob,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `collection_schema` (
	`collection` text PRIMARY KEY,
	`schema` blob NOT NULL
);
--> statement-breakpoint
CREATE TABLE `item_asset` (
	`itemId` blob NOT NULL,
	`assetId` blob NOT NULL,
	CONSTRAINT `item_asset_pk` PRIMARY KEY(`itemId`, `assetId`),
	CONSTRAINT `fk_item_asset_itemId_items_id_fk` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_item_asset_assetId_asset_id_fk` FOREIGN KEY (`assetId`) REFERENCES `asset`(`id`) ON DELETE CASCADE
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
CREATE TABLE `media_variant` (
	`id` blob PRIMARY KEY,
	`assetId` blob NOT NULL,
	`ext` text NOT NULL,
	`optsHash` integer NOT NULL,
	`opts` blob,
	`size` integer NOT NULL,
	`data` blob NOT NULL,
	`createdAt` integer NOT NULL,
	CONSTRAINT `fk_media_variant_assetId_asset_id_fk` FOREIGN KEY (`assetId`) REFERENCES `asset`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `sync` (
	`index` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_items_ref` ON `items` (`ref`);--> statement-breakpoint
CREATE INDEX `idx_items_collection` ON `items` (`collection`);--> statement-breakpoint
CREATE INDEX `idx_items_changedAt` ON `items` (`changedAt`);--> statement-breakpoint
CREATE INDEX `idx_variant_lookup` ON `media_variant` (`assetId`,`ext`,`optsHash`);