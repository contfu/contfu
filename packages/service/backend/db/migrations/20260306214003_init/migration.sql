CREATE ROLE "app_user";--> statement-breakpoint
CREATE ROLE "service_role";--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO "app_user", "service_role";--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "app_user", "service_role";--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "app_user", "service_role";--> statement-breakpoint
CREATE TABLE "account" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "account_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" integer NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "collection" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collection_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"displayName" text NOT NULL,
	"name" text NOT NULL,
	"schema" bytea NOT NULL,
	"refTargets" bytea,
	"includeRef" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "collection" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "consumer_collection" (
	"userId" integer NOT NULL,
	"consumerId" integer,
	"collectionId" integer,
	"includeRef" boolean DEFAULT true NOT NULL,
	"lastItemChanged" timestamp with time zone,
	"lastConsistencyCheck" timestamp with time zone,
	CONSTRAINT "consumer_collection_pkey" PRIMARY KEY("consumerId","collectionId")
);
--> statement-breakpoint
ALTER TABLE "consumer_collection" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "consumer" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "consumer_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"key" bytea UNIQUE,
	"name" text NOT NULL,
	"includeRef" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consumer" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "incident" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "incident_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"influxId" integer NOT NULL,
	"type" integer NOT NULL,
	"message" text NOT NULL,
	"details" bytea,
	"resolved" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"resolvedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "incident" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "influx" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "influx_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"collectionId" integer NOT NULL,
	"sourceCollectionId" integer NOT NULL,
	"schema" bytea,
	"mappings" bytea,
	"filters" bytea,
	"includeRef" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "influx" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "integration_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"providerId" text NOT NULL,
	"label" text NOT NULL,
	"accountId" text,
	"credentials" bytea,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "integration" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "item_id_conflict_resolution" (
	"sourceCollectionId" integer,
	"sourceItemId" bytea,
	"id" integer NOT NULL,
	CONSTRAINT "item_id_conflict_resolution_pkey" PRIMARY KEY("sourceCollectionId","sourceItemId")
);
--> statement-breakpoint
CREATE TABLE "msgpackr_migration" (
	"tablename" text,
	"columnname" text,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "msgpackr_migration_pkey" PRIMARY KEY("tablename","columnname")
);
--> statement-breakpoint
CREATE TABLE "quota" (
	"id" integer PRIMARY KEY,
	"polarCustomerId" text,
	"subscriptionId" text,
	"subscriptionStatus" text,
	"currentPeriodEnd" timestamp with time zone,
	"sources" integer DEFAULT 0 NOT NULL,
	"maxSources" integer NOT NULL,
	"collections" integer DEFAULT 0 NOT NULL,
	"maxCollections" integer NOT NULL,
	"items" integer DEFAULT 0 NOT NULL,
	"maxItems" integer NOT NULL,
	"consumers" integer DEFAULT 0 NOT NULL,
	"maxConsumers" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "session_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL UNIQUE,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setting" (
	"key" text PRIMARY KEY,
	"value" bytea,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_collection" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "source_collection_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"sourceId" integer NOT NULL,
	"name" text NOT NULL,
	"displayName" text,
	"ref" bytea,
	"schema" bytea,
	"itemIds" bytea,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "source_collection" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "source_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"uid" uuid NOT NULL UNIQUE,
	"name" text NOT NULL,
	"url" text,
	"credentials" bytea,
	"type" integer NOT NULL,
	"webhookSecret" bytea,
	"integrationId" integer,
	"includeRef" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "source" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sync_job" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sync_job_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sourceCollectionId" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"scheduledAt" timestamp with time zone DEFAULT now() NOT NULL,
	"startedAt" timestamp with time zone,
	"completedAt" timestamp with time zone,
	"errorMessage" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"maxAttempts" integer DEFAULT 3 NOT NULL,
	"workerId" text
);
--> statement-breakpoint
ALTER TABLE "sync_job" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" integer DEFAULT 0 NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "verification_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webhook_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "webhook_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sourceId" integer NOT NULL,
	"event" text NOT NULL,
	"model" text,
	"status" text NOT NULL,
	"errorMessage" text,
	"itemsBroadcast" integer DEFAULT 0 NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webhook_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" ("userId");--> statement-breakpoint
CREATE INDEX "collection_userId_idx" ON "collection" ("userId");--> statement-breakpoint
CREATE INDEX "consumer_collection_userId_idx" ON "consumer_collection" ("userId");--> statement-breakpoint
CREATE INDEX "consumer_collection_consumerId_idx" ON "consumer_collection" ("consumerId");--> statement-breakpoint
CREATE INDEX "consumer_collection_collectionId_idx" ON "consumer_collection" ("collectionId");--> statement-breakpoint
CREATE INDEX "consumer_userId_idx" ON "consumer" ("userId");--> statement-breakpoint
CREATE INDEX "incident_userId_idx" ON "incident" ("userId");--> statement-breakpoint
CREATE INDEX "incident_influxId_idx" ON "incident" ("influxId");--> statement-breakpoint
CREATE INDEX "influx_userId_idx" ON "influx" ("userId");--> statement-breakpoint
CREATE INDEX "influx_collectionId_idx" ON "influx" ("collectionId");--> statement-breakpoint
CREATE INDEX "influx_sourceCollectionId_idx" ON "influx" ("sourceCollectionId");--> statement-breakpoint
CREATE INDEX "integration_userId_idx" ON "integration" ("userId");--> statement-breakpoint
CREATE INDEX "item_id_conflict_sourceCollectionId_idx" ON "item_id_conflict_resolution" ("sourceCollectionId");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" ("userId");--> statement-breakpoint
CREATE INDEX "source_collection_userId_idx" ON "source_collection" ("userId");--> statement-breakpoint
CREATE INDEX "source_collection_sourceId_idx" ON "source_collection" ("sourceId");--> statement-breakpoint
CREATE INDEX "source_userId_idx" ON "source" ("userId");--> statement-breakpoint
CREATE INDEX "sync_job_sourceCollectionId_idx" ON "sync_job" ("sourceCollectionId");--> statement-breakpoint
CREATE INDEX "sync_job_queue_idx" ON "sync_job" ("status","scheduledAt");--> statement-breakpoint
CREATE INDEX "sync_job_status_idx" ON "sync_job" ("status","startedAt");--> statement-breakpoint
CREATE INDEX "webhook_log_sourceId_idx" ON "webhook_log" ("sourceId");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection" ADD CONSTRAINT "collection_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "consumer_collection" ADD CONSTRAINT "consumer_collection_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "consumer_collection" ADD CONSTRAINT "consumer_collection_consumerId_consumer_id_fkey" FOREIGN KEY ("consumerId") REFERENCES "consumer"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "consumer_collection" ADD CONSTRAINT "consumer_collection_collectionId_collection_id_fkey" FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "consumer" ADD CONSTRAINT "consumer_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "incident" ADD CONSTRAINT "incident_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "incident" ADD CONSTRAINT "incident_influxId_influx_id_fkey" FOREIGN KEY ("influxId") REFERENCES "influx"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "influx" ADD CONSTRAINT "influx_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "influx" ADD CONSTRAINT "influx_collectionId_collection_id_fkey" FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "influx" ADD CONSTRAINT "influx_sourceCollectionId_source_collection_id_fkey" FOREIGN KEY ("sourceCollectionId") REFERENCES "source_collection"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "integration" ADD CONSTRAINT "integration_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "item_id_conflict_resolution" ADD CONSTRAINT "item_id_conflict_resolution_3laooM9Jrtn7_fkey" FOREIGN KEY ("sourceCollectionId") REFERENCES "source_collection"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quota" ADD CONSTRAINT "quota_id_user_id_fkey" FOREIGN KEY ("id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "source_collection" ADD CONSTRAINT "source_collection_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "source_collection" ADD CONSTRAINT "source_collection_sourceId_source_id_fkey" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "source" ADD CONSTRAINT "source_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "source" ADD CONSTRAINT "source_integrationId_integration_id_fkey" FOREIGN KEY ("integrationId") REFERENCES "integration"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "sync_job" ADD CONSTRAINT "sync_job_sourceCollectionId_source_collection_id_fkey" FOREIGN KEY ("sourceCollectionId") REFERENCES "source_collection"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "webhook_log" ADD CONSTRAINT "webhook_log_sourceId_source_id_fkey" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "collection_user_isolation" ON "collection" AS PERMISSIVE FOR ALL TO "app_user" USING ("collection"."userId" = current_setting('app.current_user_id', true)::integer) WITH CHECK ("collection"."userId" = current_setting('app.current_user_id', true)::integer);--> statement-breakpoint
CREATE POLICY "consumer_collection_user_isolation" ON "consumer_collection" AS PERMISSIVE FOR ALL TO "app_user" USING ("consumer_collection"."userId" = current_setting('app.current_user_id', true)::integer) WITH CHECK ("consumer_collection"."userId" = current_setting('app.current_user_id', true)::integer);--> statement-breakpoint
CREATE POLICY "consumer_user_isolation" ON "consumer" AS PERMISSIVE FOR ALL TO "app_user" USING ("consumer"."userId" = current_setting('app.current_user_id', true)::integer) WITH CHECK ("consumer"."userId" = current_setting('app.current_user_id', true)::integer);--> statement-breakpoint
CREATE POLICY "incident_user_isolation" ON "incident" AS PERMISSIVE FOR ALL TO "app_user" USING ("incident"."userId" = current_setting('app.current_user_id', true)::integer) WITH CHECK ("incident"."userId" = current_setting('app.current_user_id', true)::integer);--> statement-breakpoint
CREATE POLICY "influx_user_isolation" ON "influx" AS PERMISSIVE FOR ALL TO "app_user" USING ("influx"."userId" = current_setting('app.current_user_id', true)::integer) WITH CHECK ("influx"."userId" = current_setting('app.current_user_id', true)::integer);--> statement-breakpoint
CREATE POLICY "integration_user_isolation" ON "integration" AS PERMISSIVE FOR ALL TO "app_user" USING ("integration"."userId" = current_setting('app.current_user_id', true)::integer) WITH CHECK ("integration"."userId" = current_setting('app.current_user_id', true)::integer);--> statement-breakpoint
CREATE POLICY "source_collection_user_isolation" ON "source_collection" AS PERMISSIVE FOR ALL TO "app_user" USING ("source_collection"."userId" = current_setting('app.current_user_id', true)::integer) WITH CHECK ("source_collection"."userId" = current_setting('app.current_user_id', true)::integer);--> statement-breakpoint
CREATE POLICY "source_user_isolation" ON "source" AS PERMISSIVE FOR ALL TO "app_user" USING ("source"."userId" = current_setting('app.current_user_id', true)::integer) WITH CHECK ("source"."userId" = current_setting('app.current_user_id', true)::integer);--> statement-breakpoint
CREATE POLICY "sync_job_user_isolation" ON "sync_job" AS PERMISSIVE FOR ALL TO "app_user" USING (
        exists (
          select 1
          from "source_collection" sc
          where sc.id = "sync_job"."sourceCollectionId"
            and sc."userId" = current_setting('app.current_user_id', true)::integer
        )
      ) WITH CHECK (
        exists (
          select 1
          from "source_collection" sc
          where sc.id = "sync_job"."sourceCollectionId"
            and sc."userId" = current_setting('app.current_user_id', true)::integer
        )
      );--> statement-breakpoint
CREATE POLICY "webhook_log_user_isolation" ON "webhook_log" AS PERMISSIVE FOR ALL TO "app_user" USING (
        exists (
          select 1
          from "source" s
          where s.id = "webhook_log"."sourceId"
            and s."userId" = current_setting('app.current_user_id', true)::integer
        )
      ) WITH CHECK (
        exists (
          select 1
          from "source" s
          where s.id = "webhook_log"."sourceId"
            and s."userId" = current_setting('app.current_user_id', true)::integer
        )
      );