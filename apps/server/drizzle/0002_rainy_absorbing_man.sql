CREATE TYPE "public"."pin_type" AS ENUM('device', 'virtual', 'user', 'simulator');--> statement-breakpoint
ALTER TABLE "users_pin" ADD COLUMN "type" "pin_type" DEFAULT 'device' NOT NULL;