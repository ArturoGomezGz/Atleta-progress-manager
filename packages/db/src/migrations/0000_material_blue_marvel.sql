CREATE TYPE "public"."assigned_session_status" AS ENUM('pending', 'in_progress', 'completed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."athlete_session_execution_status" AS ENUM('in_progress', 'completed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."body_zone" AS ENUM('upper', 'lower', 'core');--> statement-breakpoint
CREATE TYPE "public"."muscle_role" AS ENUM('primary', 'secondary');--> statement-breakpoint
CREATE TYPE "public"."exercise_difficulty" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."exercise_movement_pattern" AS ENUM('push', 'pull', 'squat', 'hinge', 'carry', 'rotation', 'isometric', 'mobility');--> statement-breakpoint
CREATE TYPE "public"."exercise_suitable_for" AS ENUM('warmup', 'evaluation');--> statement-breakpoint
CREATE TYPE "public"."report_source" AS ENUM('ai', 'coach');--> statement-breakpoint
CREATE TYPE "public"."exercise_goal" AS ENUM('strength', 'hypertrophy', 'endurance', 'power', 'cardio', 'recovery');--> statement-breakpoint
CREATE TYPE "public"."routine_type" AS ENUM('sequential', 'circuit');--> statement-breakpoint
CREATE TYPE "public"."athlete_session_status" AS ENUM('active', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."rm_source" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."set_status" AS ENUM('valid', 'invalid');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('coach', 'athlete');--> statement-breakpoint
CREATE TABLE "assigned_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_id" uuid,
	"team_id" uuid NOT NULL,
	"assigned_by" text NOT NULL,
	"assigned_to_athlete_id" text,
	"assigned_to_group_id" uuid,
	"scheduled_date" date NOT NULL,
	"status" "assigned_session_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "athlete_session_execution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assigned_session_id" uuid NOT NULL,
	"athlete_id" text NOT NULL,
	"status" "athlete_session_execution_status" DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "athlete_set_completion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" uuid NOT NULL,
	"routine_exercise_id" uuid,
	"set_number" integer NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"team_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_group_member" (
	"group_id" uuid NOT NULL,
	"athlete_id" text NOT NULL,
	CONSTRAINT "team_group_member_group_id_athlete_id_pk" PRIMARY KEY("group_id","athlete_id")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_global" boolean DEFAULT false NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "exercise_equipment" (
	"exercise_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	CONSTRAINT "exercise_equipment_exercise_id_equipment_id_pk" PRIMARY KEY("exercise_id","equipment_id")
);
--> statement-breakpoint
CREATE TABLE "exercise_muscle" (
	"exercise_id" uuid NOT NULL,
	"muscle_id" uuid NOT NULL,
	"role" "muscle_role" NOT NULL,
	CONSTRAINT "exercise_muscle_exercise_id_muscle_id_pk" PRIMARY KEY("exercise_id","muscle_id")
);
--> statement-breakpoint
CREATE TABLE "muscle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"muscle_group_id" uuid NOT NULL,
	CONSTRAINT "muscle_name_group_unique" UNIQUE("name","muscle_group_id")
);
--> statement-breakpoint
CREATE TABLE "muscle_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"body_zone" "body_zone" NOT NULL,
	CONSTRAINT "muscle_group_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "exercise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"difficulty" "exercise_difficulty",
	"movement_patterns" "exercise_movement_pattern"[] DEFAULT '{}'::exercise_movement_pattern[] NOT NULL,
	"suitable_for" "exercise_suitable_for",
	"contraindications" text,
	"video_url" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"owner_user_id" text,
	"owner_team_id" uuid,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "exercise_save" (
	"user_id" text NOT NULL,
	"exercise_id" uuid NOT NULL,
	"saved_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_save_user_id_exercise_id_pk" PRIMARY KEY("user_id","exercise_id")
);
--> statement-breakpoint
CREATE TABLE "exercise_progress_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" text NOT NULL,
	"exercise_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"content" text NOT NULL,
	"report_source" "report_source" DEFAULT 'ai' NOT NULL,
	"seen_at" timestamp with time zone,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trigger_rm_id" uuid,
	CONSTRAINT "uq_report_athlete_exercise" UNIQUE("athlete_id","exercise_id")
);
--> statement-breakpoint
CREATE TABLE "routine" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"team_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"type" "routine_type" DEFAULT 'sequential' NOT NULL,
	"circuit_rounds" integer,
	"circuit_duration_seconds" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine_exercise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"tempo" text,
	"rest_seconds" integer,
	"goal" "exercise_goal",
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "routine_set_target" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_exercise_id" uuid NOT NULL,
	"set_number" integer NOT NULL,
	"target_reps" integer,
	"target_percent" numeric(5, 2)
);
--> statement-breakpoint
CREATE TABLE "athlete_exercise_rm" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" text NOT NULL,
	"exercise_id" uuid NOT NULL,
	"rm_lbs" numeric(6, 2) NOT NULL,
	"source" "rm_source" NOT NULL,
	"session_id" uuid,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "athlete_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"athlete_id" text NOT NULL,
	"status" "athlete_session_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "athlete_session_exercise_cancelled" (
	"athlete_session_id" uuid NOT NULL,
	"session_exercise_id" uuid NOT NULL,
	CONSTRAINT "athlete_session_exercise_cancelled_athlete_session_id_session_exercise_id_pk" PRIMARY KEY("athlete_session_id","session_exercise_id")
);
--> statement-breakpoint
CREATE TABLE "session_exercise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_set_target" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_exercise_id" uuid NOT NULL,
	"set_number" integer NOT NULL,
	"target_reps" integer,
	"target_percent" numeric(5, 2)
);
--> statement-breakpoint
CREATE TABLE "set_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_session_id" uuid NOT NULL,
	"session_exercise_id" uuid NOT NULL,
	"session_set_target_id" uuid,
	"set_number" integer NOT NULL,
	"reps" integer NOT NULL,
	"weight_lbs" numeric(6, 2) DEFAULT '0' NOT NULL,
	"status" "set_status" DEFAULT 'valid' NOT NULL,
	"recorded_by" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_id" uuid,
	"team_id" uuid NOT NULL,
	"started_by" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "session_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"max_athletes" integer DEFAULT 1 NOT NULL,
	"max_coaches" integer DEFAULT 1 NOT NULL,
	"logo_data_url" text,
	"brand_palette" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_by" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_invite_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "team_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "team_role" NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assigned_session" ADD CONSTRAINT "assigned_session_routine_id_routine_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routine"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assigned_session" ADD CONSTRAINT "assigned_session_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assigned_session" ADD CONSTRAINT "assigned_session_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assigned_session" ADD CONSTRAINT "assigned_session_assigned_to_athlete_id_user_id_fk" FOREIGN KEY ("assigned_to_athlete_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assigned_session" ADD CONSTRAINT "assigned_session_assigned_to_group_id_team_group_id_fk" FOREIGN KEY ("assigned_to_group_id") REFERENCES "public"."team_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_session_execution" ADD CONSTRAINT "athlete_session_execution_assigned_session_id_assigned_session_id_fk" FOREIGN KEY ("assigned_session_id") REFERENCES "public"."assigned_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_session_execution" ADD CONSTRAINT "athlete_session_execution_athlete_id_user_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_set_completion" ADD CONSTRAINT "athlete_set_completion_execution_id_athlete_session_execution_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."athlete_session_execution"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_set_completion" ADD CONSTRAINT "athlete_set_completion_routine_exercise_id_routine_exercise_id_fk" FOREIGN KEY ("routine_exercise_id") REFERENCES "public"."routine_exercise"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_group" ADD CONSTRAINT "team_group_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_group" ADD CONSTRAINT "team_group_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_group_member" ADD CONSTRAINT "team_group_member_group_id_team_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."team_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_group_member" ADD CONSTRAINT "team_group_member_athlete_id_user_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_equipment" ADD CONSTRAINT "exercise_equipment_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_equipment" ADD CONSTRAINT "exercise_equipment_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscle" ADD CONSTRAINT "exercise_muscle_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscle" ADD CONSTRAINT "exercise_muscle_muscle_id_muscle_id_fk" FOREIGN KEY ("muscle_id") REFERENCES "public"."muscle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muscle" ADD CONSTRAINT "muscle_muscle_group_id_muscle_group_id_fk" FOREIGN KEY ("muscle_group_id") REFERENCES "public"."muscle_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_owner_team_id_team_id_fk" FOREIGN KEY ("owner_team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_save" ADD CONSTRAINT "exercise_save_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_save" ADD CONSTRAINT "exercise_save_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_progress_report" ADD CONSTRAINT "exercise_progress_report_athlete_id_user_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_progress_report" ADD CONSTRAINT "exercise_progress_report_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_progress_report" ADD CONSTRAINT "exercise_progress_report_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_progress_report" ADD CONSTRAINT "exercise_progress_report_trigger_rm_id_athlete_exercise_rm_id_fk" FOREIGN KEY ("trigger_rm_id") REFERENCES "public"."athlete_exercise_rm"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine" ADD CONSTRAINT "routine_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine" ADD CONSTRAINT "routine_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_exercise" ADD CONSTRAINT "routine_exercise_routine_id_routine_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routine"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_exercise" ADD CONSTRAINT "routine_exercise_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_set_target" ADD CONSTRAINT "routine_set_target_routine_exercise_id_routine_exercise_id_fk" FOREIGN KEY ("routine_exercise_id") REFERENCES "public"."routine_exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_exercise_rm" ADD CONSTRAINT "athlete_exercise_rm_athlete_id_user_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_exercise_rm" ADD CONSTRAINT "athlete_exercise_rm_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_exercise_rm" ADD CONSTRAINT "athlete_exercise_rm_session_id_training_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_session" ADD CONSTRAINT "athlete_session_session_id_training_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_session" ADD CONSTRAINT "athlete_session_athlete_id_user_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_session_exercise_cancelled" ADD CONSTRAINT "athlete_session_exercise_cancelled_athlete_session_id_athlete_session_id_fk" FOREIGN KEY ("athlete_session_id") REFERENCES "public"."athlete_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_session_exercise_cancelled" ADD CONSTRAINT "athlete_session_exercise_cancelled_session_exercise_id_session_exercise_id_fk" FOREIGN KEY ("session_exercise_id") REFERENCES "public"."session_exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercise" ADD CONSTRAINT "session_exercise_session_id_training_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercise" ADD CONSTRAINT "session_exercise_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_set_target" ADD CONSTRAINT "session_set_target_session_exercise_id_session_exercise_id_fk" FOREIGN KEY ("session_exercise_id") REFERENCES "public"."session_exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_record" ADD CONSTRAINT "set_record_athlete_session_id_athlete_session_id_fk" FOREIGN KEY ("athlete_session_id") REFERENCES "public"."athlete_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_record" ADD CONSTRAINT "set_record_session_exercise_id_session_exercise_id_fk" FOREIGN KEY ("session_exercise_id") REFERENCES "public"."session_exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_record" ADD CONSTRAINT "set_record_session_set_target_id_session_set_target_id_fk" FOREIGN KEY ("session_set_target_id") REFERENCES "public"."session_set_target"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_record" ADD CONSTRAINT "set_record_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_routine_id_routine_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routine"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_started_by_user_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_name_system_unique" ON "exercise" USING btree ("name") WHERE "owner_user_id" IS NULL AND "owner_team_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_name_user_unique" ON "exercise" USING btree ("name","owner_user_id") WHERE "owner_user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_name_team_unique" ON "exercise" USING btree ("name","owner_team_id") WHERE "owner_team_id" IS NOT NULL;