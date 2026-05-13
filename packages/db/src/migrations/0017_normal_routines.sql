-- Routine type
DO $$ BEGIN
  CREATE TYPE "routine_type" AS ENUM('sequential', 'circuit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Exercise goal
DO $$ BEGIN
  CREATE TYPE "exercise_goal" AS ENUM('strength', 'hypertrophy', 'endurance', 'power', 'cardio', 'recovery');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Assigned session status
DO $$ BEGIN
  CREATE TYPE "assigned_session_status" AS ENUM('pending', 'in_progress', 'completed', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Athlete session execution status
DO $$ BEGIN
  CREATE TYPE "athlete_session_execution_status" AS ENUM('in_progress', 'completed', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enrich routine
ALTER TABLE "routine" ADD COLUMN IF NOT EXISTS "type" "routine_type" NOT NULL DEFAULT 'sequential';
ALTER TABLE "routine" ADD COLUMN IF NOT EXISTS "circuit_rounds" integer;
ALTER TABLE "routine" ADD COLUMN IF NOT EXISTS "circuit_duration_seconds" integer;

-- Enrich routine_exercise
ALTER TABLE "routine_exercise" ADD COLUMN IF NOT EXISTS "tempo" text;
ALTER TABLE "routine_exercise" ADD COLUMN IF NOT EXISTS "rest_seconds" integer;
ALTER TABLE "routine_exercise" ADD COLUMN IF NOT EXISTS "goal" "exercise_goal";
ALTER TABLE "routine_exercise" ADD COLUMN IF NOT EXISTS "notes" text;

-- Groups
CREATE TABLE IF NOT EXISTS "team_group" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "team_id" uuid NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "team_group_member" (
  "group_id" uuid NOT NULL REFERENCES "team_group"("id") ON DELETE CASCADE,
  "athlete_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  PRIMARY KEY ("group_id", "athlete_id")
);

-- Assigned sessions
CREATE TABLE IF NOT EXISTS "assigned_session" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "routine_id" uuid REFERENCES "routine"("id") ON DELETE SET NULL,
  "team_id" uuid NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
  "assigned_by" text NOT NULL REFERENCES "user"("id"),
  "assigned_to_athlete_id" text REFERENCES "user"("id") ON DELETE CASCADE,
  "assigned_to_group_id" uuid REFERENCES "team_group"("id") ON DELETE CASCADE,
  "scheduled_date" date NOT NULL,
  "status" "assigned_session_status" NOT NULL DEFAULT 'pending',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Athlete execution
CREATE TABLE IF NOT EXISTS "athlete_session_execution" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "assigned_session_id" uuid NOT NULL REFERENCES "assigned_session"("id") ON DELETE CASCADE,
  "athlete_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "status" "athlete_session_execution_status" NOT NULL DEFAULT 'in_progress',
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz,
  CONSTRAINT "athlete_session_execution_unique" UNIQUE ("assigned_session_id", "athlete_id")
);

CREATE TABLE IF NOT EXISTS "athlete_set_completion" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "execution_id" uuid NOT NULL REFERENCES "athlete_session_execution"("id") ON DELETE CASCADE,
  "routine_exercise_id" uuid REFERENCES "routine_exercise"("id") ON DELETE SET NULL,
  "set_number" integer NOT NULL,
  "completed_at" timestamptz NOT NULL DEFAULT now()
);
