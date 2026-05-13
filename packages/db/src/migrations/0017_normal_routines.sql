CREATE TYPE "public"."routine_type" AS ENUM('sequential', 'circuit');--> statement-breakpoint
CREATE TYPE "public"."exercise_goal" AS ENUM('strength', 'hypertrophy', 'endurance', 'power', 'cardio', 'recovery');--> statement-breakpoint
CREATE TYPE "public"."assigned_session_status" AS ENUM('pending', 'in_progress', 'completed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."athlete_session_execution_status" AS ENUM('in_progress', 'completed', 'skipped');--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN IF NOT EXISTS "type" "public"."routine_type" NOT NULL DEFAULT 'sequential';--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN IF NOT EXISTS "circuit_rounds" integer;--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN IF NOT EXISTS "circuit_duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "routine_exercise" ADD COLUMN IF NOT EXISTS "tempo" text;--> statement-breakpoint
ALTER TABLE "routine_exercise" ADD COLUMN IF NOT EXISTS "rest_seconds" integer;--> statement-breakpoint
ALTER TABLE "routine_exercise" ADD COLUMN IF NOT EXISTS "goal" "public"."exercise_goal";--> statement-breakpoint
ALTER TABLE "routine_exercise" ADD COLUMN IF NOT EXISTS "notes" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"team_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team_group_member" (
	"group_id" uuid NOT NULL,
	"athlete_id" text NOT NULL,
	CONSTRAINT "team_group_member_pk" PRIMARY KEY("group_id","athlete_id")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assigned_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_id" uuid,
	"team_id" uuid NOT NULL,
	"assigned_by" text NOT NULL,
	"assigned_to_athlete_id" text,
	"assigned_to_group_id" uuid,
	"scheduled_date" date NOT NULL,
	"status" "public"."assigned_session_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "athlete_session_execution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assigned_session_id" uuid NOT NULL,
	"athlete_id" text NOT NULL,
	"status" "public"."athlete_session_execution_status" DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "athlete_session_execution_unique" UNIQUE("assigned_session_id","athlete_id")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "athlete_set_completion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" uuid NOT NULL,
	"routine_exercise_id" uuid,
	"set_number" integer NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "team_group" ADD CONSTRAINT "team_group_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_group" ADD CONSTRAINT "team_group_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_group_member" ADD CONSTRAINT "team_group_member_group_id_team_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."team_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_group_member" ADD CONSTRAINT "team_group_member_athlete_id_user_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assigned_session" ADD CONSTRAINT "assigned_session_routine_id_routine_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routine"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assigned_session" ADD CONSTRAINT "assigned_session_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assigned_session" ADD CONSTRAINT "assigned_session_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assigned_session" ADD CONSTRAINT "assigned_session_assigned_to_athlete_id_user_id_fk" FOREIGN KEY ("assigned_to_athlete_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assigned_session" ADD CONSTRAINT "assigned_session_assigned_to_group_id_team_group_id_fk" FOREIGN KEY ("assigned_to_group_id") REFERENCES "public"."team_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_session_execution" ADD CONSTRAINT "athlete_session_execution_assigned_session_id_fk" FOREIGN KEY ("assigned_session_id") REFERENCES "public"."assigned_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_session_execution" ADD CONSTRAINT "athlete_session_execution_athlete_id_user_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_set_completion" ADD CONSTRAINT "athlete_set_completion_execution_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."athlete_session_execution"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_set_completion" ADD CONSTRAINT "athlete_set_completion_routine_exercise_id_fk" FOREIGN KEY ("routine_exercise_id") REFERENCES "public"."routine_exercise"("id") ON DELETE set null ON UPDATE no action;
