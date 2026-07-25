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
ALTER TABLE `items` ADD `deletedAt` integer;--> statement-breakpoint
CREATE INDEX `idx_items_deletedAt` ON `items` (`deletedAt`);