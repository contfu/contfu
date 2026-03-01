ALTER TABLE "collection" ADD COLUMN "displayName" text;--> statement-breakpoint
UPDATE "collection" SET "displayName" = "name";--> statement-breakpoint
ALTER TABLE "collection" ALTER COLUMN "displayName" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "source" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
CREATE TABLE "msgpackr_migration" (
	"tablename" text NOT NULL,
	"columnname" text NOT NULL,
	"version" integer NOT NULL DEFAULT 0,
	CONSTRAINT "msgpackr_migration_pkey" PRIMARY KEY ("tablename", "columnname")
);
