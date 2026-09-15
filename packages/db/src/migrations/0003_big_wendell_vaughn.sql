CREATE TYPE "public"."guest_workout_status" AS ENUM('active', 'completed', 'claimed');--> statement-breakpoint
CREATE TABLE "guest_set_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_workout_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"exercise_order" integer NOT NULL,
	"set_number" integer NOT NULL,
	"reps" integer NOT NULL,
	"weight_lbs" numeric(6, 2) DEFAULT '0' NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest_workout" (
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
);
--> statement-breakpoint
CREATE TABLE "routine_share" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"code" text NOT NULL,
	"created_by" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routine_share_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "guest_set_record" ADD CONSTRAINT "guest_set_record_guest_workout_id_guest_workout_id_fk" FOREIGN KEY ("guest_workout_id") REFERENCES "public"."guest_workout"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_set_record" ADD CONSTRAINT "guest_set_record_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_workout" ADD CONSTRAINT "guest_workout_share_id_routine_share_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."routine_share"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_workout" ADD CONSTRAINT "guest_workout_routine_id_routine_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routine"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_workout" ADD CONSTRAINT "guest_workout_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_workout" ADD CONSTRAINT "guest_workout_claimed_by_user_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_workout" ADD CONSTRAINT "guest_workout_claimed_session_id_training_session_id_fk" FOREIGN KEY ("claimed_session_id") REFERENCES "public"."training_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_share" ADD CONSTRAINT "routine_share_routine_id_routine_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routine"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_share" ADD CONSTRAINT "routine_share_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_share" ADD CONSTRAINT "routine_share_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guest_set_record_workout_idx" ON "guest_set_record" USING btree ("guest_workout_id");--> statement-breakpoint
CREATE INDEX "guest_workout_share_idx" ON "guest_workout" USING btree ("share_id");--> statement-breakpoint
CREATE INDEX "routine_share_routine_idx" ON "routine_share" USING btree ("routine_id");