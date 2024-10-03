CREATE SCHEMA "access";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "access"."account" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" "bytea" NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "account_key_unique" UNIQUE("key"),
	CONSTRAINT "account_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "access"."quotas" (
	"id" serial PRIMARY KEY NOT NULL,
	"sources" integer NOT NULL,
	"max_sources" integer NOT NULL,
	"collections" integer NOT NULL,
	"max_collections" integer NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access"."quotas" ADD CONSTRAINT "quotas_id_account_id_fk" FOREIGN KEY ("id") REFERENCES "access"."account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
