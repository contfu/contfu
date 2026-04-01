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
CREATE TABLE `collections` (
	`name` text PRIMARY KEY,
	`displayName` text NOT NULL,
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
	`connectionType` integer,
	`ref` text,
	`collection` text NOT NULL,
	`props` blob,
	`content` blob,
	`changedAt` integer NOT NULL,
	CONSTRAINT `fk_items_collection_collections_name_fk` FOREIGN KEY (`collection`) REFERENCES `collections`(`name`) ON UPDATE CASCADE
);
--> statement-breakpoint
CREATE TABLE `links` (
	`id` integer PRIMARY KEY,
	`prop` text,
	`from` blob NOT NULL,
	`to` blob NOT NULL,
	`internal` integer NOT NULL,
	CONSTRAINT `fk_links_from_items_id_fk` FOREIGN KEY (`from`) REFERENCES `items`(`id`) ON DELETE CASCADE
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
CREATE INDEX `idx_links_from` ON `links` (`from`,`to`);--> statement-breakpoint
CREATE INDEX `idx_links_to` ON `links` (`to`);--> statement-breakpoint
CREATE INDEX `idx_variant_lookup` ON `media_variant` (`assetId`,`ext`,`optsHash`);