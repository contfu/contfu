ALTER TABLE "collection" ADD COLUMN "includeRef" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "connection" ADD COLUMN "includeRef" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "consumer" ADD COLUMN "includeRef" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "source" ADD COLUMN "credentialsSource" integer;--> statement-breakpoint
ALTER TABLE "influx" ALTER COLUMN "includeRef" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "influx" ALTER COLUMN "includeRef" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "source" ALTER COLUMN "includeRef" SET DEFAULT true;