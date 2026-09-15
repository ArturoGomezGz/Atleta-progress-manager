CREATE TYPE "public"."exercise_reaction_reason" AS ENUM('video_roto', 'video_no_corresponde', 'datos_incorrectos', 'duplicado', 'no_me_sirve', 'otro');--> statement-breakpoint
CREATE TYPE "public"."exercise_reaction_value" AS ENUM('positive', 'negative');--> statement-breakpoint
CREATE TABLE "exercise_stats" (
	"exercise_id" uuid PRIMARY KEY NOT NULL,
	"unique_coaches" integer DEFAULT 0 NOT NULL,
	"unique_routines" integer DEFAULT 0 NOT NULL,
	"session_uses" integer DEFAULT 0 NOT NULL,
	"completed_uses" integer DEFAULT 0 NOT NULL,
	"cancelled_uses" integer DEFAULT 0 NOT NULL,
	"saves" integer DEFAULT 0 NOT NULL,
	"positive_reactions" integer DEFAULT 0 NOT NULL,
	"negative_reactions" integer DEFAULT 0 NOT NULL,
	"open_reports" integer DEFAULT 0 NOT NULL,
	"score" double precision DEFAULT 0 NOT NULL,
	"is_recommended" boolean DEFAULT false NOT NULL,
	"window_days" integer DEFAULT 180 NOT NULL,
	"last_computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_reaction" (
	"user_id" text NOT NULL,
	"exercise_id" uuid NOT NULL,
	"value" "exercise_reaction_value" NOT NULL,
	"reason" "exercise_reaction_reason",
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_reaction_user_id_exercise_id_pk" PRIMARY KEY("user_id","exercise_id")
);
--> statement-breakpoint
ALTER TABLE "exercise_stats" ADD CONSTRAINT "exercise_stats_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_reaction" ADD CONSTRAINT "exercise_reaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_reaction" ADD CONSTRAINT "exercise_reaction_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercise_stats_score_idx" ON "exercise_stats" USING btree ("score");--> statement-breakpoint
CREATE INDEX "exercise_reaction_exercise_idx" ON "exercise_reaction" USING btree ("exercise_id");