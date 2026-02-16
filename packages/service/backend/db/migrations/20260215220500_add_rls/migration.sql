DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT app_user TO CURRENT_USER;
--> statement-breakpoint
GRANT service_role TO CURRENT_USER;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_user, service_role;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user, service_role;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user, service_role;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user, service_role;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO app_user, service_role;
--> statement-breakpoint
ALTER TABLE "source" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "source_collection" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "collection" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "consumer" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "influx" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "connection" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "incident" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "webhook_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sync_job" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "source_user_isolation" ON "source";
--> statement-breakpoint
CREATE POLICY "source_user_isolation" ON "source"
  FOR ALL
  TO app_user
  USING ("userId" = current_setting('app.current_user_id', true)::integer)
  WITH CHECK ("userId" = current_setting('app.current_user_id', true)::integer);
--> statement-breakpoint
DROP POLICY IF EXISTS "source_collection_user_isolation" ON "source_collection";
--> statement-breakpoint
CREATE POLICY "source_collection_user_isolation" ON "source_collection"
  FOR ALL
  TO app_user
  USING ("userId" = current_setting('app.current_user_id', true)::integer)
  WITH CHECK ("userId" = current_setting('app.current_user_id', true)::integer);
--> statement-breakpoint
DROP POLICY IF EXISTS "collection_user_isolation" ON "collection";
--> statement-breakpoint
CREATE POLICY "collection_user_isolation" ON "collection"
  FOR ALL
  TO app_user
  USING ("userId" = current_setting('app.current_user_id', true)::integer)
  WITH CHECK ("userId" = current_setting('app.current_user_id', true)::integer);
--> statement-breakpoint
DROP POLICY IF EXISTS "consumer_user_isolation" ON "consumer";
--> statement-breakpoint
CREATE POLICY "consumer_user_isolation" ON "consumer"
  FOR ALL
  TO app_user
  USING ("userId" = current_setting('app.current_user_id', true)::integer)
  WITH CHECK ("userId" = current_setting('app.current_user_id', true)::integer);
--> statement-breakpoint
DROP POLICY IF EXISTS "influx_user_isolation" ON "influx";
--> statement-breakpoint
CREATE POLICY "influx_user_isolation" ON "influx"
  FOR ALL
  TO app_user
  USING ("userId" = current_setting('app.current_user_id', true)::integer)
  WITH CHECK ("userId" = current_setting('app.current_user_id', true)::integer);
--> statement-breakpoint
DROP POLICY IF EXISTS "connection_user_isolation" ON "connection";
--> statement-breakpoint
CREATE POLICY "connection_user_isolation" ON "connection"
  FOR ALL
  TO app_user
  USING ("userId" = current_setting('app.current_user_id', true)::integer)
  WITH CHECK ("userId" = current_setting('app.current_user_id', true)::integer);
--> statement-breakpoint
DROP POLICY IF EXISTS "incident_user_isolation" ON "incident";
--> statement-breakpoint
CREATE POLICY "incident_user_isolation" ON "incident"
  FOR ALL
  TO app_user
  USING ("userId" = current_setting('app.current_user_id', true)::integer)
  WITH CHECK ("userId" = current_setting('app.current_user_id', true)::integer);
--> statement-breakpoint
DROP POLICY IF EXISTS "webhook_log_user_isolation" ON "webhook_log";
--> statement-breakpoint
CREATE POLICY "webhook_log_user_isolation" ON "webhook_log"
  FOR ALL
  TO app_user
  USING (
    EXISTS (
      SELECT 1
      FROM "source" s
      WHERE s.id = "webhook_log"."sourceId"
        AND s."userId" = current_setting('app.current_user_id', true)::integer
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "source" s
      WHERE s.id = "webhook_log"."sourceId"
        AND s."userId" = current_setting('app.current_user_id', true)::integer
    )
  );
--> statement-breakpoint
DROP POLICY IF EXISTS "sync_job_user_isolation" ON "sync_job";
--> statement-breakpoint
CREATE POLICY "sync_job_user_isolation" ON "sync_job"
  FOR ALL
  TO app_user
  USING (
    EXISTS (
      SELECT 1
      FROM "source_collection" sc
      WHERE sc.id = "sync_job"."sourceCollectionId"
        AND sc."userId" = current_setting('app.current_user_id', true)::integer
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "source_collection" sc
      WHERE sc.id = "sync_job"."sourceCollectionId"
        AND sc."userId" = current_setting('app.current_user_id', true)::integer
    )
  );
