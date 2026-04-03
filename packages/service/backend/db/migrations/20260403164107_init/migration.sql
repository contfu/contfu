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
	"userId" integer,
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
	"metadata" text,
	"referenceId" text
);
--> statement-breakpoint
CREATE TABLE "collection" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collection_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"connectionId" integer,
	"displayName" text NOT NULL,
	"name" text NOT NULL,
	"ref" bytea,
	"schema" bytea NOT NULL,
	"refTargets" bytea,
	"includeRef" boolean DEFAULT true NOT NULL,
	"icon" bytea,
	"notionPropertyIds" bytea,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "collection" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "connection" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "connection_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"type" integer NOT NULL,
	"name" text NOT NULL,
	"accountId" text,
	"credentials" bytea,
	"url" text,
	"uid" uuid UNIQUE,
	"webhookSecret" bytea,
	"includeRef" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "connection" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "flow" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "flow_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"sourceId" integer NOT NULL,
	"targetId" integer NOT NULL,
	"schema" bytea,
	"mappings" bytea,
	"filters" bytea,
	"includeRef" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone,
	CONSTRAINT "flow_source_target_unique" UNIQUE("sourceId","targetId")
);
--> statement-breakpoint
ALTER TABLE "flow" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "incident" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "incident_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"flowId" integer NOT NULL,
	"type" integer NOT NULL,
	"message" text NOT NULL,
	"details" bytea,
	"resolved" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"resolvedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "incident" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "item_id_conflict_resolution" (
	"collectionId" integer,
	"sourceItemId" bytea,
	"id" integer NOT NULL,
	CONSTRAINT "item_id_conflict_resolution_pkey" PRIMARY KEY("collectionId","sourceItemId")
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
	"connections" integer DEFAULT 0 NOT NULL,
	"maxConnections" integer NOT NULL,
	"collections" integer DEFAULT 0 NOT NULL,
	"maxCollections" integer NOT NULL,
	"flows" integer DEFAULT 0 NOT NULL,
	"maxFlows" integer NOT NULL,
	"items" integer DEFAULT 0 NOT NULL,
	"maxItems" integer NOT NULL
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
CREATE TABLE "sync_job" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sync_job_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"collectionId" integer NOT NULL,
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
	"basePlan" integer DEFAULT 0 NOT NULL,
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
	"connectionId" integer NOT NULL,
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
CREATE INDEX "collection_connectionId_idx" ON "collection" ("connectionId");--> statement-breakpoint
CREATE INDEX "connection_userId_idx" ON "connection" ("userId");--> statement-breakpoint
CREATE INDEX "flow_userId_idx" ON "flow" ("userId");--> statement-breakpoint
CREATE INDEX "flow_sourceId_idx" ON "flow" ("sourceId");--> statement-breakpoint
CREATE INDEX "flow_targetId_idx" ON "flow" ("targetId");--> statement-breakpoint
CREATE INDEX "incident_userId_idx" ON "incident" ("userId");--> statement-breakpoint
CREATE INDEX "incident_flowId_idx" ON "incident" ("flowId");--> statement-breakpoint
CREATE INDEX "item_id_conflict_collectionId_idx" ON "item_id_conflict_resolution" ("collectionId");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" ("userId");--> statement-breakpoint
CREATE INDEX "sync_job_collectionId_idx" ON "sync_job" ("collectionId");--> statement-breakpoint
CREATE INDEX "sync_job_queue_idx" ON "sync_job" ("status","scheduledAt");--> statement-breakpoint
CREATE INDEX "sync_job_status_idx" ON "sync_job" ("status","startedAt");--> statement-breakpoint
CREATE INDEX "webhook_log_connectionId_idx" ON "webhook_log" ("connectionId");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection" ADD CONSTRAINT "collection_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection" ADD CONSTRAINT "collection_connectionId_connection_id_fkey" FOREIGN KEY ("connectionId") REFERENCES "connection"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "connection" ADD CONSTRAINT "connection_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "flow" ADD CONSTRAINT "flow_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "flow" ADD CONSTRAINT "flow_sourceId_collection_id_fkey" FOREIGN KEY ("sourceId") REFERENCES "collection"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "flow" ADD CONSTRAINT "flow_targetId_collection_id_fkey" FOREIGN KEY ("targetId") REFERENCES "collection"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "incident" ADD CONSTRAINT "incident_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "incident" ADD CONSTRAINT "incident_flowId_flow_id_fkey" FOREIGN KEY ("flowId") REFERENCES "flow"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "item_id_conflict_resolution" ADD CONSTRAINT "item_id_conflict_resolution_collectionId_collection_id_fkey" FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quota" ADD CONSTRAINT "quota_id_user_id_fkey" FOREIGN KEY ("id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sync_job" ADD CONSTRAINT "sync_job_collectionId_collection_id_fkey" FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "webhook_log" ADD CONSTRAINT "webhook_log_connectionId_connection_id_fkey" FOREIGN KEY ("connectionId") REFERENCES "connection"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "collection_user_isolation" ON "collection" AS PERMISSIVE FOR ALL TO "app_user" USING ("collection"."userId" = current_setting('app.current_user_id', true)::integer) WITH CHECK ("collection"."userId" = current_setting('app.current_user_id', true)::integer);--> statement-breakpoint
CREATE POLICY "connection_user_isolation" ON "connection" AS PERMISSIVE FOR ALL TO "app_user" USING ("connection"."userId" = current_setting('app.current_user_id', true)::integer) WITH CHECK ("connection"."userId" = current_setting('app.current_user_id', true)::integer);--> statement-breakpoint
CREATE POLICY "flow_user_isolation" ON "flow" AS PERMISSIVE FOR ALL TO "app_user" USING ("flow"."userId" = current_setting('app.current_user_id', true)::integer) WITH CHECK ("flow"."userId" = current_setting('app.current_user_id', true)::integer);--> statement-breakpoint
CREATE POLICY "incident_user_isolation" ON "incident" AS PERMISSIVE FOR ALL TO "app_user" USING ("incident"."userId" = current_setting('app.current_user_id', true)::integer) WITH CHECK ("incident"."userId" = current_setting('app.current_user_id', true)::integer);--> statement-breakpoint
CREATE POLICY "sync_job_user_isolation" ON "sync_job" AS PERMISSIVE FOR ALL TO "app_user" USING (
        exists (
          select 1
          from "collection" c
          where c.id = "sync_job"."collectionId"
            and c."userId" = current_setting('app.current_user_id', true)::integer
        )
      ) WITH CHECK (
        exists (
          select 1
          from "collection" c
          where c.id = "sync_job"."collectionId"
            and c."userId" = current_setting('app.current_user_id', true)::integer
        )
      );--> statement-breakpoint
CREATE POLICY "webhook_log_user_isolation" ON "webhook_log" AS PERMISSIVE FOR ALL TO "app_user" USING (
        exists (
          select 1
          from "connection" c
          where c.id = "webhook_log"."connectionId"
            and c."userId" = current_setting('app.current_user_id', true)::integer
        )
      ) WITH CHECK (
        exists (
          select 1
          from "connection" c
          where c.id = "webhook_log"."connectionId"
            and c."userId" = current_setting('app.current_user_id', true)::integer
        )
      );