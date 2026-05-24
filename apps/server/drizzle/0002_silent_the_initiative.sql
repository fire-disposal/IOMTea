CREATE TYPE "public"."adherence_status" AS ENUM('taken', 'missed', 'skipped', 'delayed');--> statement-breakpoint
CREATE TYPE "public"."blood_type" AS ENUM('A', 'B', 'AB', 'O');--> statement-breakpoint
CREATE TYPE "public"."checklist_status" AS ENUM('pending', 'done', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."confirmation_method" AS ENUM('self', 'family', 'auto', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."event_source" AS ENUM('iot', 'cv', 'simulator', 'manual');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TYPE "public"."medication_route" AS ENUM('oral', 'injection', 'topical', 'inhalation', 'other');--> statement-breakpoint
CREATE TYPE "public"."medication_status" AS ENUM('active', 'completed', 'paused', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('earn', 'spend', 'adjust');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled', 'pending');--> statement-breakpoint
ALTER TYPE "public"."alert_status" ADD VALUE 'expired';--> statement-breakpoint
ALTER TYPE "public"."alert_status" ADD VALUE 'new';--> statement-breakpoint
ALTER TYPE "public"."alert_status" ADD VALUE 'assigned';--> statement-breakpoint
ALTER TYPE "public"."alert_status" ADD VALUE 'handled';--> statement-breakpoint
ALTER TYPE "public"."alert_status" ADD VALUE 'closed';--> statement-breakpoint
ALTER TYPE "public"."device_status" ADD VALUE 'error';--> statement-breakpoint
ALTER TYPE "public"."kind" ADD VALUE 'behavior';--> statement-breakpoint
ALTER TYPE "public"."kind" ADD VALUE 'location';--> statement-breakpoint
ALTER TYPE "public"."patient_status" ADD VALUE 'archived';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'patient';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'family';--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	CONSTRAINT "permissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "role" NOT NULL,
	"permission_code" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wechat_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"open_id" text NOT NULL,
	"union_id" text,
	"nickname" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wechat_accounts_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "wechat_accounts_open_id_unique" UNIQUE("open_id")
);
--> statement-breakpoint
CREATE TABLE "medication_adherence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"due_date" date NOT NULL,
	"due_time" time NOT NULL,
	"taken_at" timestamp with time zone,
	"status" "adherence_status" DEFAULT 'missed' NOT NULL,
	"confirmed_by" "confirmation_method" DEFAULT 'unknown',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medication_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"medication_id" uuid NOT NULL,
	"scheduled_time" time NOT NULL,
	"day_of_week" integer[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"drug_name" text NOT NULL,
	"generic_name" text,
	"dosage" text NOT NULL,
	"dosage_unit" text NOT NULL,
	"frequency" text NOT NULL,
	"route" "medication_route" DEFAULT 'oral' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"instructions" text,
	"status" "medication_status" DEFAULT 'active' NOT NULL,
	"prescribed_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users_pin" (
	"pin" varchar(6) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"label" varchar(64) DEFAULT '',
	"nickname" varchar(32) DEFAULT '',
	"thing_id" uuid,
	"room_id" varchar(64),
	"is_virtual" boolean DEFAULT false,
	"generator_config" jsonb DEFAULT '{}',
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"module_key" varchar(50),
	"streak_day" integer,
	"type" "transaction_type" DEFAULT 'earn' NOT NULL,
	"source" varchar(100) DEFAULT 'record' NOT NULL,
	"checklist_id" uuid,
	"event_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"module_key" varchar(50) NOT NULL,
	"status" "checklist_status" DEFAULT 'pending' NOT NULL,
	"plan_item_id" uuid,
	"record_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"module_key" varchar(50) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"reminder_enabled" boolean DEFAULT false NOT NULL,
	"reminder_times" jsonb DEFAULT '[]' NOT NULL,
	"frequency" varchar(20) DEFAULT 'daily' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) DEFAULT '我的健康计划' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"module_key" varchar(50) NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_record_date" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ingest_raw_data" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "audit_logs" CASCADE;--> statement-breakpoint
DROP TABLE "ingest_raw_data" CASCADE;--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "events_device_id_devices_id_fk";
--> statement-breakpoint
ALTER TABLE "devices" ALTER COLUMN "status" SET DEFAULT 'inactive';--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "device_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "metric" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "unit" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "gender" SET DATA TYPE gender;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "model" varchar(100);--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "manufacturer" varchar(100);--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "firmware_version" varchar(50);--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "room_id" varchar(64);--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "config" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "pin_code" varchar(6);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "confidence" real;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "source" "event_source" DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "height_cm" real;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "weight_kg" real;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "blood_type" "blood_type";--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "phone" varchar(20);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "emergency_contact" varchar(100);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "emergency_phone" varchar(20);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "primary_doctor_id" uuid;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "user_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "credit" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_code_permissions_code_fk" FOREIGN KEY ("permission_code") REFERENCES "public"."permissions"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wechat_accounts" ADD CONSTRAINT "wechat_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_adherence" ADD CONSTRAINT "medication_adherence_schedule_id_medication_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."medication_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_schedules" ADD CONSTRAINT "medication_schedules_medication_id_medications_id_fk" FOREIGN KEY ("medication_id") REFERENCES "public"."medications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_prescribed_by_id_users_id_fk" FOREIGN KEY ("prescribed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_pin" ADD CONSTRAINT "users_pin_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_checklist_id_daily_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."daily_checklists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_checklists" ADD CONSTRAINT "daily_checklists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_checklists" ADD CONSTRAINT "daily_checklists_plan_item_id_plan_items_id_fk" FOREIGN KEY ("plan_item_id") REFERENCES "public"."plan_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_checklists" ADD CONSTRAINT "daily_checklists_record_id_events_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_unique" ON "role_permissions" USING btree ("role","permission_code");--> statement-breakpoint
CREATE UNIQUE INDEX "adherence_unique" ON "medication_adherence" USING btree ("schedule_id","due_date","due_time");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_checklist_unique" ON "daily_checklists" USING btree ("user_id","date","module_key");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_checklist_user_date_idx" ON "daily_checklists" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_items_unique" ON "plan_items" USING btree ("plan_id","module_key");--> statement-breakpoint
CREATE UNIQUE INDEX "streaks_unique" ON "streaks" USING btree ("user_id","module_key");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_primary_doctor_id_users_id_fk" FOREIGN KEY ("primary_doctor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_patient_source_idx" ON "events" USING btree ("patient_id","source");--> statement-breakpoint
ALTER TABLE "patients" DROP COLUMN "room";--> statement-breakpoint
ALTER TABLE "patients" DROP COLUMN "bed_number";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_phone_unique" UNIQUE("phone");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");