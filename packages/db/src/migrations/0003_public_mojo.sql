CREATE TABLE "exercise_progress_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" text NOT NULL,
	"exercise_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"content" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trigger_rm_id" uuid,
	CONSTRAINT "uq_report_athlete_exercise" UNIQUE("athlete_id","exercise_id")
);
--> statement-breakpoint
ALTER TABLE "exercise_progress_report" ADD CONSTRAINT "exercise_progress_report_athlete_id_user_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_progress_report" ADD CONSTRAINT "exercise_progress_report_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_progress_report" ADD CONSTRAINT "exercise_progress_report_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_progress_report" ADD CONSTRAINT "exercise_progress_report_trigger_rm_id_athlete_exercise_rm_id_fk" FOREIGN KEY ("trigger_rm_id") REFERENCES "public"."athlete_exercise_rm"("id") ON DELETE set null ON UPDATE no action;
