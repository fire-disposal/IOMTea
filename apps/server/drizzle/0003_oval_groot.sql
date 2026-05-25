ALTER TABLE "sessions" ALTER COLUMN "started_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "ended_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "tags" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
CREATE INDEX "events_session_id_idx" ON "events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "sessions_patient_id_idx" ON "sessions" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "sessions_status_idx" ON "sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sessions_started_at_idx" ON "sessions" USING btree ("started_at");