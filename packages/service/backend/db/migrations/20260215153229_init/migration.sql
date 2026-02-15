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
CREATE TABLE "collection" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collection_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "connection" (
	"userId" integer NOT NULL,
	"consumerId" integer,
	"collectionId" integer,
	"lastItemChanged" timestamp with time zone,
	"lastConsistencyCheck" timestamp with time zone,
	CONSTRAINT "connection_pkey" PRIMARY KEY("consumerId","collectionId")
);
--> statement-breakpoint
CREATE TABLE "consumer" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "consumer_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"key" bytea UNIQUE,
	"name" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "influx" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "influx_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"collectionId" integer NOT NULL,
	"sourceCollectionId" integer NOT NULL,
	"schema" bytea,
	"filters" bytea,
	"includeRef" boolean,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "item_id_conflict_resolution" (
	"sourceCollectionId" integer,
	"sourceItemId" bytea,
	"id" integer NOT NULL,
	CONSTRAINT "item_id_conflict_resolution_pkey" PRIMARY KEY("sourceCollectionId","sourceItemId")
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
CREATE TABLE "source" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "source_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"uid" uuid NOT NULL UNIQUE,
	"name" text,
	"url" text,
	"credentials" bytea,
	"type" integer NOT NULL,
	"webhookSecret" bytea,
	"includeRef" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
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
CREATE INDEX "account_userId_idx" ON "account" ("userId");--> statement-breakpoint
CREATE INDEX "collection_userId_idx" ON "collection" ("userId");--> statement-breakpoint
CREATE INDEX "connection_userId_idx" ON "connection" ("userId");--> statement-breakpoint
CREATE INDEX "connection_consumerId_idx" ON "connection" ("consumerId");--> statement-breakpoint
CREATE INDEX "connection_collectionId_idx" ON "connection" ("collectionId");--> statement-breakpoint
CREATE INDEX "consumer_userId_idx" ON "consumer" ("userId");--> statement-breakpoint
CREATE INDEX "incident_userId_idx" ON "incident" ("userId");--> statement-breakpoint
CREATE INDEX "incident_influxId_idx" ON "incident" ("influxId");--> statement-breakpoint
CREATE INDEX "influx_userId_idx" ON "influx" ("userId");--> statement-breakpoint
CREATE INDEX "influx_collectionId_idx" ON "influx" ("collectionId");--> statement-breakpoint
CREATE INDEX "influx_sourceCollectionId_idx" ON "influx" ("sourceCollectionId");--> statement-breakpoint
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
ALTER TABLE "connection" ADD CONSTRAINT "connection_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "connection" ADD CONSTRAINT "connection_consumerId_consumer_id_fkey" FOREIGN KEY ("consumerId") REFERENCES "consumer"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "connection" ADD CONSTRAINT "connection_collectionId_collection_id_fkey" FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "consumer" ADD CONSTRAINT "consumer_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "incident" ADD CONSTRAINT "incident_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "incident" ADD CONSTRAINT "incident_influxId_influx_id_fkey" FOREIGN KEY ("influxId") REFERENCES "influx"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "influx" ADD CONSTRAINT "influx_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "influx" ADD CONSTRAINT "influx_collectionId_collection_id_fkey" FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "influx" ADD CONSTRAINT "influx_sourceCollectionId_source_collection_id_fkey" FOREIGN KEY ("sourceCollectionId") REFERENCES "source_collection"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "item_id_conflict_resolution" ADD CONSTRAINT "item_id_conflict_resolution_3laooM9Jrtn7_fkey" FOREIGN KEY ("sourceCollectionId") REFERENCES "source_collection"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quota" ADD CONSTRAINT "quota_id_user_id_fkey" FOREIGN KEY ("id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "source_collection" ADD CONSTRAINT "source_collection_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "source_collection" ADD CONSTRAINT "source_collection_sourceId_source_id_fkey" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "source" ADD CONSTRAINT "source_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sync_job" ADD CONSTRAINT "sync_job_sourceCollectionId_source_collection_id_fkey" FOREIGN KEY ("sourceCollectionId") REFERENCES "source_collection"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "webhook_log" ADD CONSTRAINT "webhook_log_sourceId_source_id_fkey" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE;