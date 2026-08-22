PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_sync` (
	`key` integer PRIMARY KEY NOT NULL DEFAULT 1,
	`index` integer NOT NULL,
	CONSTRAINT "sync_singleton_key" CHECK("key" = 1)
);
--> statement-breakpoint
INSERT INTO `__new_sync`(`key`, `index`)
SELECT 1, MAX(`index`) FROM `sync` HAVING COUNT(*) > 0;
--> statement-breakpoint
DROP TABLE `sync`;
--> statement-breakpoint
ALTER TABLE `__new_sync` RENAME TO `sync`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;