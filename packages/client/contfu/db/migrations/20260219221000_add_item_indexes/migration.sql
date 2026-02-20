CREATE INDEX `idx_items_collection` ON `items` (`collection`);
--> statement-breakpoint
CREATE INDEX `idx_items_changedAt` ON `items` (`changedAt`);
--> statement-breakpoint
CREATE INDEX `idx_items_ref` ON `items` (`ref`);
