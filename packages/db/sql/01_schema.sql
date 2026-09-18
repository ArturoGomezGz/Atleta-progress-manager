-- ═══════════════════════════════════════════════════════════════════════════
-- 01 · Esquema de base de datos
-- Generado por packages/db/scripts/build-sql.ts — no editar a mano.
-- Idempotente: seguro de re-ejecutar.
-- ═══════════════════════════════════════════════════════════════════════════
-- Incluye las migraciones: 0000_youtube_baseline, 0001_happy_blockbuster, 0002_flat_mongu, 0003_big_wendell_vaughn
-- La API también corre el migrador de Drizzle al arrancar; como aquí se registra el hash,
-- no intentará volver a crear las tablas.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

-- Migración 0000_youtube_baseline
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = 'c98616675d4be33c01de7b48258700961d579b5142e40cb57f1178149c0108c6') THEN
    RAISE NOTICE 'Migración 0000_youtube_baseline ya aplicada, se omite';
    RETURN;
  END IF;
  EXECUTE $stmt$CREATE TYPE "public"."body_zone" AS ENUM('upper', 'lower', 'core')$stmt$;
  EXECUTE $stmt$CREATE TYPE "public"."muscle_role" AS ENUM('primary', 'secondary')$stmt$;
  EXECUTE $stmt$CREATE TYPE "public"."exercise_difficulty" AS ENUM('beginner', 'intermediate', 'advanced')$stmt$;
  EXECUTE $stmt$CREATE TYPE "public"."exercise_movement_pattern" AS ENUM('push', 'pull', 'squat', 'hinge', 'carry', 'rotation', 'isometric', 'mobility', 'core')$stmt$;
  EXECUTE $stmt$CREATE TYPE "public"."exercise_suitable_for" AS ENUM('warmup', 'evaluation')$stmt$;
  EXECUTE $stmt$CREATE TYPE "public"."video_orientation" AS ENUM('horizontal', 'vertical')$stmt$;
  EXECUTE $stmt$CREATE TYPE "public"."report_source" AS ENUM('ai', 'coach')$stmt$;
  EXECUTE $stmt$CREATE TYPE "public"."routine_category" AS ENUM('evaluation', 'training')$stmt$;
  EXECUTE $stmt$CREATE TYPE "public"."athlete_session_status" AS ENUM('scheduled', 'active', 'cancelled', 'completed')$stmt$;
  EXECUTE $stmt$CREATE TYPE "public"."rm_source" AS ENUM('auto', 'manual')$stmt$;
  EXECUTE $stmt$CREATE TYPE "public"."session_status" AS ENUM('scheduled', 'active', 'completed', 'cancelled')$stmt$;
  EXECUTE $stmt$CREATE TYPE "public"."set_status" AS ENUM('valid', 'invalid')$stmt$;
  EXECUTE $stmt$CREATE TYPE "public"."team_role" AS ENUM('coach', 'athlete')$stmt$;
  EXECUTE $stmt$CREATE TABLE "account" (
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
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_global" boolean DEFAULT false NOT NULL,
	"created_by" text
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "exercise_equipment" (
	"exercise_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	CONSTRAINT "exercise_equipment_exercise_id_equipment_id_pk" PRIMARY KEY("exercise_id","equipment_id")
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "exercise_muscle" (
	"exercise_id" uuid NOT NULL,
	"muscle_id" uuid NOT NULL,
	"role" "muscle_role" NOT NULL,
	CONSTRAINT "exercise_muscle_exercise_id_muscle_id_pk" PRIMARY KEY("exercise_id","muscle_id")
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "muscle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"muscle_group_id" uuid NOT NULL,
	CONSTRAINT "muscle_name_group_unique" UNIQUE("name","muscle_group_id")
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "muscle_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"body_zone" "body_zone" NOT NULL,
	CONSTRAINT "muscle_group_name_unique" UNIQUE("name")
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "exercise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"difficulty" "exercise_difficulty",
	"movement_patterns" "exercise_movement_pattern"[] DEFAULT '{}'::exercise_movement_pattern[] NOT NULL,
	"suitable_for" "exercise_suitable_for",
	"contraindications" text,
	"youtube_video_id" text,
	"youtube_title" text,
	"video_orientation" "video_orientation" DEFAULT 'horizontal' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"owner_user_id" text,
	"owner_team_id" uuid,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "exercise_save" (
	"user_id" text NOT NULL,
	"exercise_id" uuid NOT NULL,
	"saved_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_save_user_id_exercise_id_pk" PRIMARY KEY("user_id","exercise_id")
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"rest_timer_enabled" boolean DEFAULT false NOT NULL,
	"rest_timer_seconds" integer DEFAULT 90 NOT NULL
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "exercise_progress_report" (
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
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "routine" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"team_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"category" "routine_category" DEFAULT 'training' NOT NULL,
	"content" jsonb DEFAULT '{"v":1,"items":[]}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "athlete_exercise_rm" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" text NOT NULL,
	"exercise_id" uuid NOT NULL,
	"rm_lbs" numeric(6, 2) NOT NULL,
	"source" "rm_source" NOT NULL,
	"session_id" uuid,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "athlete_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"athlete_id" text NOT NULL,
	"status" "athlete_session_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"rpe" integer
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "athlete_session_exercise_cancelled" (
	"athlete_session_id" uuid NOT NULL,
	"session_exercise_id" uuid NOT NULL,
	CONSTRAINT "athlete_session_exercise_cancelled_athlete_session_id_session_exercise_id_pk" PRIMARY KEY("athlete_session_id","session_exercise_id")
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "session_exercise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"order" integer NOT NULL
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "session_set_target" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_exercise_id" uuid NOT NULL,
	"set_number" integer NOT NULL,
	"set_type" text DEFAULT 'reps' NOT NULL,
	"target_reps" integer,
	"target_duration_seconds" integer,
	"target_percent" numeric(5, 2)
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "set_record" (
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
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "training_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_id" uuid,
	"team_id" uuid NOT NULL,
	"started_by" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scheduled_date" date,
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"content" jsonb
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"max_athletes" integer DEFAULT 1 NOT NULL,
	"max_coaches" integer DEFAULT 1 NOT NULL,
	"logo_data_url" text,
	"brand_palette" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "team_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"team_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "team_group_member" (
	"group_id" uuid NOT NULL,
	"athlete_id" text NOT NULL,
	CONSTRAINT "team_group_member_group_id_athlete_id_pk" PRIMARY KEY("group_id","athlete_id")
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "team_invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_by" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_invite_token_unique" UNIQUE("token")
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "team_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "team_role" NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
)$stmt$;
  EXECUTE $stmt$ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "equipment" ADD CONSTRAINT "equipment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "exercise_equipment" ADD CONSTRAINT "exercise_equipment_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "exercise_equipment" ADD CONSTRAINT "exercise_equipment_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "exercise_muscle" ADD CONSTRAINT "exercise_muscle_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "exercise_muscle" ADD CONSTRAINT "exercise_muscle_muscle_id_muscle_id_fk" FOREIGN KEY ("muscle_id") REFERENCES "public"."muscle"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "muscle" ADD CONSTRAINT "muscle_muscle_group_id_muscle_group_id_fk" FOREIGN KEY ("muscle_group_id") REFERENCES "public"."muscle_group"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "exercise" ADD CONSTRAINT "exercise_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "exercise" ADD CONSTRAINT "exercise_owner_team_id_team_id_fk" FOREIGN KEY ("owner_team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "exercise" ADD CONSTRAINT "exercise_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "exercise_save" ADD CONSTRAINT "exercise_save_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "exercise_save" ADD CONSTRAINT "exercise_save_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "exercise_progress_report" ADD CONSTRAINT "exercise_progress_report_athlete_id_user_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "exercise_progress_report" ADD CONSTRAINT "exercise_progress_report_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "exercise_progress_report" ADD CONSTRAINT "exercise_progress_report_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "exercise_progress_report" ADD CONSTRAINT "exercise_progress_report_trigger_rm_id_athlete_exercise_rm_id_fk" FOREIGN KEY ("trigger_rm_id") REFERENCES "public"."athlete_exercise_rm"("id") ON DELETE set null ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "routine" ADD CONSTRAINT "routine_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "routine" ADD CONSTRAINT "routine_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "athlete_exercise_rm" ADD CONSTRAINT "athlete_exercise_rm_athlete_id_user_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "athlete_exercise_rm" ADD CONSTRAINT "athlete_exercise_rm_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "athlete_exercise_rm" ADD CONSTRAINT "athlete_exercise_rm_session_id_training_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_session"("id") ON DELETE set null ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "athlete_session" ADD CONSTRAINT "athlete_session_session_id_training_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_session"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "athlete_session" ADD CONSTRAINT "athlete_session_athlete_id_user_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "athlete_session_exercise_cancelled" ADD CONSTRAINT "athlete_session_exercise_cancelled_athlete_session_id_athlete_session_id_fk" FOREIGN KEY ("athlete_session_id") REFERENCES "public"."athlete_session"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "athlete_session_exercise_cancelled" ADD CONSTRAINT "athlete_session_exercise_cancelled_session_exercise_id_session_exercise_id_fk" FOREIGN KEY ("session_exercise_id") REFERENCES "public"."session_exercise"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "session_exercise" ADD CONSTRAINT "session_exercise_session_id_training_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_session"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "session_exercise" ADD CONSTRAINT "session_exercise_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE no action ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "session_set_target" ADD CONSTRAINT "session_set_target_session_exercise_id_session_exercise_id_fk" FOREIGN KEY ("session_exercise_id") REFERENCES "public"."session_exercise"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "set_record" ADD CONSTRAINT "set_record_athlete_session_id_athlete_session_id_fk" FOREIGN KEY ("athlete_session_id") REFERENCES "public"."athlete_session"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "set_record" ADD CONSTRAINT "set_record_session_exercise_id_session_exercise_id_fk" FOREIGN KEY ("session_exercise_id") REFERENCES "public"."session_exercise"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "set_record" ADD CONSTRAINT "set_record_session_set_target_id_session_set_target_id_fk" FOREIGN KEY ("session_set_target_id") REFERENCES "public"."session_set_target"("id") ON DELETE set null ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "set_record" ADD CONSTRAINT "set_record_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "training_session" ADD CONSTRAINT "training_session_routine_id_routine_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routine"("id") ON DELETE set null ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "training_session" ADD CONSTRAINT "training_session_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "training_session" ADD CONSTRAINT "training_session_started_by_user_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "team_group" ADD CONSTRAINT "team_group_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "team_group" ADD CONSTRAINT "team_group_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "team_group_member" ADD CONSTRAINT "team_group_member_group_id_team_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."team_group"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "team_group_member" ADD CONSTRAINT "team_group_member_athlete_id_user_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$CREATE UNIQUE INDEX "equipment_global_name_unique" ON "equipment" USING btree ("name") WHERE "is_global" = true AND "created_by" IS NULL$stmt$;
  EXECUTE $stmt$CREATE UNIQUE INDEX "exercise_name_system_unique" ON "exercise" USING btree ("name") WHERE "owner_user_id" IS NULL AND "owner_team_id" IS NULL$stmt$;
  EXECUTE $stmt$CREATE UNIQUE INDEX "exercise_name_user_unique" ON "exercise" USING btree ("name","owner_user_id") WHERE "owner_user_id" IS NOT NULL$stmt$;
  EXECUTE $stmt$CREATE UNIQUE INDEX "exercise_name_team_unique" ON "exercise" USING btree ("name","owner_team_id") WHERE "owner_team_id" IS NOT NULL$stmt$;
  INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('c98616675d4be33c01de7b48258700961d579b5142e40cb57f1178149c0108c6', 1789240808304);
END
$migration$;

-- Migración 0001_happy_blockbuster
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = '4dd0917bb419e1636ed19c9d659a53fbfc0ea04125a1c3ae3844424793c0fd10') THEN
    RAISE NOTICE 'Migración 0001_happy_blockbuster ya aplicada, se omite';
    RETURN;
  END IF;
  EXECUTE $stmt$ALTER TABLE "user_preferences" ADD COLUMN "rest_auto_continue" boolean DEFAULT true NOT NULL$stmt$;
  INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('4dd0917bb419e1636ed19c9d659a53fbfc0ea04125a1c3ae3844424793c0fd10', 1789417995465);
END
$migration$;

-- Migración 0002_flat_mongu
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = 'fa6aa76c11cbeee93f22e9f03b01c14a5c0dad4127bc64c00d360c4b0bda005f') THEN
    RAISE NOTICE 'Migración 0002_flat_mongu ya aplicada, se omite';
    RETURN;
  END IF;
  EXECUTE $stmt$ALTER TABLE "team_member" ADD COLUMN "self_athlete" boolean DEFAULT false NOT NULL$stmt$;
  INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('fa6aa76c11cbeee93f22e9f03b01c14a5c0dad4127bc64c00d360c4b0bda005f', 1789435184618);
END
$migration$;

-- Migración 0003_big_wendell_vaughn
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = '49447fc82f00d83939bcadf0a4538a70e0bf9a6b26f7ea73de73b728ecb0f64e') THEN
    RAISE NOTICE 'Migración 0003_big_wendell_vaughn ya aplicada, se omite';
    RETURN;
  END IF;
  EXECUTE $stmt$CREATE TYPE "public"."guest_workout_status" AS ENUM('active', 'completed', 'claimed')$stmt$;
  EXECUTE $stmt$CREATE TABLE "guest_set_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_workout_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"exercise_order" integer NOT NULL,
	"set_number" integer NOT NULL,
	"reps" integer NOT NULL,
	"weight_lbs" numeric(6, 2) DEFAULT '0' NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "guest_workout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_id" uuid NOT NULL,
	"routine_id" uuid,
	"team_id" uuid NOT NULL,
	"token" text NOT NULL,
	"routine_name" text NOT NULL,
	"content" jsonb NOT NULL,
	"status" "guest_workout_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"claimed_by" text,
	"claimed_at" timestamp with time zone,
	"claimed_session_id" uuid,
	CONSTRAINT "guest_workout_token_unique" UNIQUE("token")
)$stmt$;
  EXECUTE $stmt$CREATE TABLE "routine_share" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"code" text NOT NULL,
	"created_by" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routine_share_code_unique" UNIQUE("code")
)$stmt$;
  EXECUTE $stmt$ALTER TABLE "guest_set_record" ADD CONSTRAINT "guest_set_record_guest_workout_id_guest_workout_id_fk" FOREIGN KEY ("guest_workout_id") REFERENCES "public"."guest_workout"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "guest_set_record" ADD CONSTRAINT "guest_set_record_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "guest_workout" ADD CONSTRAINT "guest_workout_share_id_routine_share_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."routine_share"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "guest_workout" ADD CONSTRAINT "guest_workout_routine_id_routine_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routine"("id") ON DELETE set null ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "guest_workout" ADD CONSTRAINT "guest_workout_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "guest_workout" ADD CONSTRAINT "guest_workout_claimed_by_user_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "guest_workout" ADD CONSTRAINT "guest_workout_claimed_session_id_training_session_id_fk" FOREIGN KEY ("claimed_session_id") REFERENCES "public"."training_session"("id") ON DELETE set null ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "routine_share" ADD CONSTRAINT "routine_share_routine_id_routine_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routine"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "routine_share" ADD CONSTRAINT "routine_share_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$ALTER TABLE "routine_share" ADD CONSTRAINT "routine_share_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action$stmt$;
  EXECUTE $stmt$CREATE INDEX "guest_set_record_workout_idx" ON "guest_set_record" USING btree ("guest_workout_id")$stmt$;
  EXECUTE $stmt$CREATE INDEX "guest_workout_share_idx" ON "guest_workout" USING btree ("share_id")$stmt$;
  EXECUTE $stmt$CREATE INDEX "routine_share_routine_idx" ON "routine_share" USING btree ("routine_id")$stmt$;
  INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('49447fc82f00d83939bcadf0a4538a70e0bf9a6b26f7ea73de73b728ecb0f64e', 1789449083879);
END
$migration$;
