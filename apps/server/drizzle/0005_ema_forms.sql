-- Migration: Add EMA forms tables (form_definitions, form_responses)
-- Creates the survey/form system tables and adds yaml_fields column

CREATE TABLE IF NOT EXISTS "form_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "description" text,
  "cron" text,
  "fields" jsonb NOT NULL DEFAULT '[]',
  "yaml_fields" text,
  "status" text NOT NULL DEFAULT 'draft',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "form_responses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "form_code" text NOT NULL,
  "patient_id" uuid NOT NULL,
  "user_id" uuid,
  "responses" jsonb NOT NULL,
  "submitted_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_form_code_form_definitions_code_fk"
  FOREIGN KEY ("form_code") REFERENCES "form_definitions"("code") ON DELETE CASCADE;
