CREATE TABLE `pageLink` (
	`type` text NOT NULL,
	`from` blob NOT NULL,
	`to` blob NOT NULL,
	CONSTRAINT `pageLink_pk` PRIMARY KEY(`type`, `from`, `to`),
	CONSTRAINT `fk_pageLink_from_page_id_fk` FOREIGN KEY (`from`) REFERENCES `page`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_pageLink_to_page_id_fk` FOREIGN KEY (`to`) REFERENCES `page`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `page` (
	`id` blob PRIMARY KEY,
	`path` text NOT NULL UNIQUE,
	`collection` text,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`content` text,
	`props` text,
	`author` text,
	`connection` integer NOT NULL,
	`publishedAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer,
	`changedAt` integer NOT NULL
);
