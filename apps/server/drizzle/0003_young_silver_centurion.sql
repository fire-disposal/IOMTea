ALTER TABLE "devices" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "devices" CASCADE;--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "events_device_id_devices_id_fk";
--> statement-breakpoint
DROP INDEX "events_device_time_idx";--> statement-breakpoint
ALTER TABLE "users_pin" ADD COLUMN "description" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "device_id";--> statement-breakpoint
ALTER TABLE "users_pin" DROP COLUMN "thing_id";