ALTER TABLE "collection" ADD COLUMN "displayName" text;--> statement-breakpoint
UPDATE "collection" SET "displayName" = "name";--> statement-breakpoint
ALTER TABLE "collection" ALTER COLUMN "displayName" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "source" ALTER COLUMN "name" SET NOT NULL;
