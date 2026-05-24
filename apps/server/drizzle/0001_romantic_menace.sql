CREATE TABLE "sim_configs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"profile_name" varchar(50) NOT NULL,
	"running" boolean DEFAULT true NOT NULL,
	"metrics" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sim_patients" (
	"sim_id" varchar(64) NOT NULL,
	"patient_id" uuid NOT NULL,
	CONSTRAINT "sim_patients_sim_id_patient_id_pk" PRIMARY KEY("sim_id","patient_id")
);
--> statement-breakpoint
ALTER TABLE "sim_patients" ADD CONSTRAINT "sim_patients_sim_id_sim_configs_id_fk" FOREIGN KEY ("sim_id") REFERENCES "public"."sim_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sim_patients" ADD CONSTRAINT "sim_patients_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;