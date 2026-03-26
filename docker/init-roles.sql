-- Create application roles for row-level security.
-- Runs once on first container init (docker-entrypoint-initdb.d).
CREATE ROLE "app_user";
CREATE ROLE "service_role";
GRANT USAGE ON SCHEMA public TO "app_user", "service_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "app_user", "service_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "app_user", "service_role";
