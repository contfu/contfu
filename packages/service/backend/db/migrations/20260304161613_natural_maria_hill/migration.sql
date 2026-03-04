CREATE TABLE "apikey" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "apikey_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"configId" text,
	"name" text,
	"start" text,
	"prefix" text,
	"key" text NOT NULL,
	"userId" integer NOT NULL,
	"refillInterval" integer,
	"refillAmount" integer,
	"lastRefillAt" timestamp(6) with time zone,
	"enabled" boolean NOT NULL,
	"rateLimitEnabled" boolean NOT NULL,
	"rateLimitTimeWindow" integer,
	"rateLimitMax" integer,
	"requestCount" integer NOT NULL,
	"remaining" integer,
	"lastRequest" timestamp(6) with time zone,
	"expiresAt" timestamp(6) with time zone,
	"createdAt" timestamp(6) with time zone NOT NULL,
	"updatedAt" timestamp(6) with time zone NOT NULL,
	"permissions" text,
	"metadata" text
);
--> statement-breakpoint
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