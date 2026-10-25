CREATE TYPE "public"."training_plan_assignment_status" AS ENUM('active', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."training_plan_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TABLE "mcp_personal_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_prefix" text NOT NULL,
	"scopes" text[] NOT NULL,
	"expires_at" timestamp,
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_personal_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "oauth_access_token" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text,
	"client_id" text NOT NULL,
	"session_id" text,
	"user_id" text,
	"reference_id" text,
	"refresh_id" text,
	"expires_at" timestamp,
	"created_at" timestamp,
	"scopes" text[] NOT NULL,
	CONSTRAINT "oauth_access_token_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "oauth_client" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text,
	"disabled" boolean DEFAULT false,
	"skip_consent" boolean,
	"enable_end_session" boolean,
	"subject_type" text,
	"scopes" text[],
	"user_id" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	"name" text,
	"uri" text,
	"icon" text,
	"contacts" text[],
	"tos" text,
	"policy" text,
	"software_id" text,
	"software_version" text,
	"software_statement" text,
	"redirect_uris" text[] NOT NULL,
	"post_logout_redirect_uris" text[],
	"token_endpoint_auth_method" text,
	"grant_types" text[],
	"response_types" text[],
	"public" boolean,
	"type" text,
	"require_pkce" boolean,
	"reference_id" text,
	"metadata" jsonb,
	CONSTRAINT "oauth_client_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_consent" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"user_id" text,
	"reference_id" text,
	"scopes" text[] NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "oauth_refresh_token" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"client_id" text NOT NULL,
	"session_id" text,
	"user_id" text NOT NULL,
	"reference_id" text,
	"expires_at" timestamp,
	"created_at" timestamp,
	"revoked" timestamp,
	"auth_time" timestamp,
	"scopes" text[] NOT NULL,
	CONSTRAINT "oauth_refresh_token_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "training_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"goal" text,
	"weeks_count" integer NOT NULL,
	"status" "training_plan_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "training_plan_weeks_check" CHECK ("training_plan"."weeks_count" between 1 and 16)
);
--> statement-breakpoint
CREATE TABLE "training_plan_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid,
	"team_id" uuid NOT NULL,
	"assigned_by" text NOT NULL,
	"start_date" date NOT NULL,
	"status" "training_plan_assignment_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"cancelled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "training_plan_week" (
	"plan_id" uuid NOT NULL,
	"week_number" integer NOT NULL,
	"name" text,
	"focus" text,
	"notes" text,
	CONSTRAINT "training_plan_week_plan_id_week_number_pk" PRIMARY KEY("plan_id","week_number")
);
--> statement-breakpoint
CREATE TABLE "training_plan_workout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"week_number" integer NOT NULL,
	"weekday" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"routine_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "training_plan_workout_weekday_check" CHECK ("training_plan_workout"."weekday" between 1 and 7)
);
--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "plan_assignment_id" uuid;--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "plan_workout_id" uuid;--> statement-breakpoint
ALTER TABLE "mcp_personal_token" ADD CONSTRAINT "mcp_personal_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_refresh_id_oauth_refresh_token_id_fk" FOREIGN KEY ("refresh_id") REFERENCES "public"."oauth_refresh_token"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_client" ADD CONSTRAINT "oauth_client_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_consent" ADD CONSTRAINT "oauth_consent_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_consent" ADD CONSTRAINT "oauth_consent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan" ADD CONSTRAINT "training_plan_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan" ADD CONSTRAINT "training_plan_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan_assignment" ADD CONSTRAINT "training_plan_assignment_plan_id_training_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plan"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan_assignment" ADD CONSTRAINT "training_plan_assignment_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan_assignment" ADD CONSTRAINT "training_plan_assignment_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan_week" ADD CONSTRAINT "training_plan_week_plan_id_training_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan_workout" ADD CONSTRAINT "training_plan_workout_routine_id_routine_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routine"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan_workout" ADD CONSTRAINT "training_plan_workout_week_fk" FOREIGN KEY ("plan_id","week_number") REFERENCES "public"."training_plan_week"("plan_id","week_number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_personal_token_user_idx" ON "mcp_personal_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_consent_user_client_idx" ON "oauth_consent" USING btree ("user_id","client_id");--> statement-breakpoint
CREATE INDEX "training_plan_team_idx" ON "training_plan" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "training_plan_workout_slot_unique" ON "training_plan_workout" USING btree ("plan_id","week_number","weekday","position");--> statement-breakpoint
CREATE INDEX "training_plan_workout_routine_idx" ON "training_plan_workout" USING btree ("routine_id");--> statement-breakpoint
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_plan_assignment_id_training_plan_assignment_id_fk" FOREIGN KEY ("plan_assignment_id") REFERENCES "public"."training_plan_assignment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_plan_workout_id_training_plan_workout_id_fk" FOREIGN KEY ("plan_workout_id") REFERENCES "public"."training_plan_workout"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "training_session_plan_assignment_idx" ON "training_session" USING btree ("plan_assignment_id");