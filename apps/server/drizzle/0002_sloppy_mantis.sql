ALTER TYPE "public"."event_source" ADD VALUE 'batch';--> statement-breakpoint
ALTER TYPE "public"."kind" ADD VALUE 'ema_response';--> statement-breakpoint
ALTER TYPE "public"."kind" ADD VALUE 'batch_record';--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"source" text NOT NULL,
	"type" text,
	"status" text DEFAULT 'active',
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"tags" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "medication_adherence" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "medication_schedules" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "credit_transactions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_checklists" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plan_items" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plans" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "streaks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "medication_adherence" CASCADE;--> statement-breakpoint
DROP TABLE "medication_schedules" CASCADE;--> statement-breakpoint
DROP TABLE "credit_transactions" CASCADE;--> statement-breakpoint
DROP TABLE "daily_checklists" CASCADE;--> statement-breakpoint
DROP TABLE "plan_items" CASCADE;--> statement-breakpoint
DROP TABLE "plans" CASCADE;--> statement-breakpoint
DROP TABLE "streaks" CASCADE;--> statement-breakpoint
UPDATE "events" SET "value" = 0 WHERE "value" IS NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "value" SET DATA TYPE jsonb USING to_jsonb("value");--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "value" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "medications" ADD COLUMN "tags" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;