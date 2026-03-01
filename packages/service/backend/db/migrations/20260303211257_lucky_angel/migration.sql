CREATE TABLE "msgpackr_migration" (
	"tablename" text,
	"columnname" text,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "msgpackr_migration_pkey" PRIMARY KEY("tablename","columnname")
);
--> statement-breakpoint
ALTER TABLE "collection" ADD COLUMN "displayName" text NOT NULL;--> statement-breakpoint
ALTER TABLE "collection" ADD COLUMN "schema" bytea NOT NULL;--> statement-breakpoint
ALTER TABLE "collection" ADD COLUMN "includeRef" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "connection" ADD COLUMN "includeRef" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "consumer" ADD COLUMN "includeRef" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "influx" ADD COLUMN "mappings" bytea;--> statement-breakpoint
ALTER TABLE "source" ADD COLUMN "credentialsSource" integer;--> statement-breakpoint
ALTER TABLE "influx" ALTER COLUMN "includeRef" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "influx" ALTER COLUMN "includeRef" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "source" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "source" ALTER COLUMN "includeRef" SET DEFAULT true;
