-- Breaking cache reset: synchronized content and checkpoint must replay together.
DROP TABLE `internal_links`;
--> statement-breakpoint
DROP TABLE `external_links`;
--> statement-breakpoint
DROP TABLE `item_files`;
--> statement-breakpoint
DROP TABLE `media_masters`;
--> statement-breakpoint
DROP TABLE `media_variants`;
--> statement-breakpoint
DROP TABLE `items`;
--> statement-breakpoint
DROP TABLE `files`;
--> statement-breakpoint
DROP TABLE `collections`;
--> statement-breakpoint
DROP TABLE `sync`;
--> statement-breakpoint
CREATE TABLE `collections` (
	`name` text PRIMARY KEY,
	`displayName` text NOT NULL,
	`schema` blob NOT NULL,
	`i18n` blob
);
--> statement-breakpoint
CREATE TABLE `external_links` (
	`id` integer PRIMARY KEY,
	`from` text NOT NULL,
	`url` text NOT NULL,
	CONSTRAINT `fk_external_links_from_items_id_fk` FOREIGN KEY (`from`) REFERENCES `items`(`identity`) ON DELETE CASCADE ON UPDATE CASCADE
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` blob PRIMARY KEY,
	`status` integer NOT NULL,
	`mediaType` text NOT NULL,
	`meta` blob NOT NULL,
	`data` blob,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `internal_links` (
	`id` integer PRIMARY KEY,
	`prop` text,
	`from` text NOT NULL,
	`to` text NOT NULL,
	CONSTRAINT `fk_internal_links_from_items_id_fk` FOREIGN KEY (`from`) REFERENCES `items`(`identity`) ON DELETE CASCADE ON UPDATE CASCADE
);
--> statement-breakpoint
CREATE TABLE `item_files` (
	`itemId` text NOT NULL,
	`fileId` blob NOT NULL,
	CONSTRAINT `item_files_pk` PRIMARY KEY(`itemId`, `fileId`),
	CONSTRAINT `fk_item_files_itemId_items_id_fk` FOREIGN KEY (`itemId`) REFERENCES `items`(`identity`) ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT `fk_item_files_fileId_files_id_fk` FOREIGN KEY (`fileId`) REFERENCES `files`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` integer NOT NULL,
	`identity` text GENERATED ALWAYS AS (json_array(collection, id)) NOT NULL UNIQUE,
	`collection` text NOT NULL,
	`props` blob,
	`locale` text,
	`content` blob,
	`changedAt` integer NOT NULL,
	`deletedAt` integer,
	PRIMARY KEY (`collection`, `id`),
	CONSTRAINT `fk_items_collection_collections_name_fk` FOREIGN KEY (`collection`) REFERENCES `collections`(`name`) ON UPDATE CASCADE
);
--> statement-breakpoint
CREATE TABLE `media_masters` (
	`fileId` blob PRIMARY KEY,
	`mediaType` text NOT NULL,
	`ext` text NOT NULL,
	`format` text NOT NULL,
	`configFingerprint` integer NOT NULL,
	`metadata` blob NOT NULL,
	`data` blob NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	CONSTRAINT `fk_media_masters_fileId_files_id_fk` FOREIGN KEY (`fileId`) REFERENCES `files`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `media_variants` (
	`fileId` blob NOT NULL,
	`ext` text NOT NULL,
	`optsHash` integer NOT NULL,
	`opts` blob,
	`size` integer NOT NULL,
	`data` blob NOT NULL,
	`createdAt` integer NOT NULL,
	CONSTRAINT `media_variants_pk` PRIMARY KEY(`fileId`, `ext`, `optsHash`),
	CONSTRAINT `fk_media_variants_fileId_files_id_fk` FOREIGN KEY (`fileId`) REFERENCES `files`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `sync` (
	`key` integer PRIMARY KEY NOT NULL DEFAULT 1 CHECK (`key` = 1),
	`index` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_external_links_from` ON `external_links` (`from`);--> statement-breakpoint
CREATE INDEX `idx_internal_links_from` ON `internal_links` (`from`,`to`);--> statement-breakpoint
CREATE INDEX `idx_internal_links_to` ON `internal_links` (`to`);--> statement-breakpoint
CREATE INDEX `idx_items_collection` ON `items` (`collection`);--> statement-breakpoint
CREATE INDEX `idx_items_locale` ON `items` (`locale`);--> statement-breakpoint
CREATE INDEX `idx_items_changedAt` ON `items` (`changedAt`);--> statement-breakpoint
CREATE INDEX `idx_items_deletedAt` ON `items` (`deletedAt`);