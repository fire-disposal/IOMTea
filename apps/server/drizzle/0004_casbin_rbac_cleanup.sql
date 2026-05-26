-- Migration: Casbin RBAC + Schema cleanup
-- Drops legacy RBAC tables, sessions table, and orphaned enums
-- Casbin adapter will auto-create casbin_rule table on next server start

-- 1. Drop FK constraint on events.session_id → sessions.id
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_session_id_sessions_id_fk";

-- 2. Drop session_id column from events
ALTER TABLE "events" DROP COLUMN IF EXISTS "session_id";

-- 3. Drop sessions table and its indexes (cascade handles remaining references)
DROP TABLE IF EXISTS "sessions" CASCADE;

-- 4. Drop legacy RBAC tables (migrated to Casbin)
DROP TABLE IF EXISTS "role_permissions" CASCADE;
DROP TABLE IF EXISTS "permissions" CASCADE;

-- 5. Drop orphaned enum types
DROP TYPE IF EXISTS "device_type" CASCADE;
DROP TYPE IF EXISTS "device_status" CASCADE;
DROP TYPE IF EXISTS "adherence_status" CASCADE;
DROP TYPE IF EXISTS "confirmation_method" CASCADE;
DROP TYPE IF EXISTS "checklist_status" CASCADE;
