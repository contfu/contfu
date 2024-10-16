CREATE SCHEMA "access";
--> statement-breakpoint
CREATE SCHEMA "data";
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."source_type" AS ENUM('notion');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "access"."account" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"activeUntil" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp,
	CONSTRAINT "account_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "access"."consumer" (
	"accountId" integer NOT NULL,
	"id" smallint NOT NULL,
	"key" "bytea",
	"name" text NOT NULL,
	"connectedTo" smallint,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "consumer_accountId_id_pk" PRIMARY KEY("accountId","id"),
	CONSTRAINT "consumer_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "access"."quota" (
	"id" serial PRIMARY KEY NOT NULL,
	"sources" integer NOT NULL,
	"maxSources" integer NOT NULL,
	"collections" integer NOT NULL,
	"maxCollections" integer NOT NULL,
	"items" integer NOT NULL,
	"maxItems" integer NOT NULL,
	"clients" integer NOT NULL,
	"maxClients" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data"."collection" (
	"accountId" integer NOT NULL,
	"sourceId" smallint NOT NULL,
	"id" smallint NOT NULL,
	"name" text NOT NULL,
	"opts" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp,
	CONSTRAINT "collection_accountId_id_pk" PRIMARY KEY("accountId","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data"."consumer_collection_connection" (
	"accountId" integer NOT NULL,
	"consumerId" smallint NOT NULL,
	"collectionId" smallint NOT NULL,
	"lastItemChanged" timestamp,
	"lastFetch" timestamp,
	"lastConsistencyCheck" timestamp,
	"ids" "bytea",
	CONSTRAINT "consumer_collection_connection_accountId_consumerId_collectionId_pk" PRIMARY KEY("accountId","consumerId","collectionId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data"."item_id_conflict_resolution" (
	"accountId" integer NOT NULL,
	"collectionId" smallint NOT NULL,
	"sourceItemId" "bytea" NOT NULL,
	"id" integer NOT NULL,
	CONSTRAINT "item_id_conflict_resolution_accountId_collectionId_sourceItemId_pk" PRIMARY KEY("accountId","collectionId","sourceItemId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data"."source" (
	"accountId" integer NOT NULL,
	"id" smallint NOT NULL,
	"key" "bytea",
	"name" text NOT NULL,
	"opts" jsonb,
	"type" "source_type" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp,
	CONSTRAINT "source_accountId_id_pk" PRIMARY KEY("accountId","id"),
	CONSTRAINT "source_key_type_unique" UNIQUE("key","type")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access"."consumer" ADD CONSTRAINT "consumer_accountId_account_id_fk" FOREIGN KEY ("accountId") REFERENCES "access"."account"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access"."quota" ADD CONSTRAINT "quota_id_account_id_fk" FOREIGN KEY ("id") REFERENCES "access"."account"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data"."collection" ADD CONSTRAINT "collection_accountId_account_id_fk" FOREIGN KEY ("accountId") REFERENCES "access"."account"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data"."collection" ADD CONSTRAINT "collection_accountId_sourceId_source_accountId_id_fk" FOREIGN KEY ("accountId","sourceId") REFERENCES "data"."source"("accountId","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data"."consumer_collection_connection" ADD CONSTRAINT "consumer_collection_connection_accountId_account_id_fk" FOREIGN KEY ("accountId") REFERENCES "access"."account"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data"."consumer_collection_connection" ADD CONSTRAINT "consumer_collection_connection_accountId_consumerId_consumer_accountId_id_fk" FOREIGN KEY ("accountId","consumerId") REFERENCES "access"."consumer"("accountId","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data"."consumer_collection_connection" ADD CONSTRAINT "consumer_collection_connection_accountId_collectionId_collection_accountId_id_fk" FOREIGN KEY ("accountId","collectionId") REFERENCES "data"."collection"("accountId","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data"."item_id_conflict_resolution" ADD CONSTRAINT "item_id_conflict_resolution_accountId_account_id_fk" FOREIGN KEY ("accountId") REFERENCES "access"."account"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data"."item_id_conflict_resolution" ADD CONSTRAINT "item_id_conflict_resolution_accountId_collectionId_collection_accountId_id_fk" FOREIGN KEY ("accountId","collectionId") REFERENCES "data"."collection"("accountId","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data"."source" ADD CONSTRAINT "source_accountId_account_id_fk" FOREIGN KEY ("accountId") REFERENCES "access"."account"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
