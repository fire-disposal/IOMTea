CREATE TABLE "user_patient_links" (
	"user_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"relation" varchar(20) DEFAULT 'caregiver' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_patient_links_user_id_patient_id_pk" PRIMARY KEY("user_id","patient_id")
);
--> statement-breakpoint
ALTER TABLE "patients" DROP CONSTRAINT "patients_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "patients" DROP CONSTRAINT "patients_primary_doctor_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_patient_links" ADD CONSTRAINT "user_patient_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_patient_links" ADD CONSTRAINT "user_patient_links_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_pin_code_users_pin_pin_fk" FOREIGN KEY ("pin_code") REFERENCES "public"."users_pin"("pin") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "patients" DROP COLUMN "primary_doctor_id";