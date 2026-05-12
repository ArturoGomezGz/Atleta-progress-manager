CREATE TYPE "public"."exercise_difficulty" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."exercise_movement_pattern" AS ENUM('push', 'pull', 'squat', 'hinge', 'carry', 'rotation', 'isometric', 'mobility');--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "difficulty" "exercise_difficulty";--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "movement_patterns" "exercise_movement_pattern"[] DEFAULT '{}'::exercise_movement_pattern[] NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "is_warmup_suitable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "is_evaluation_suitable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "contraindications" text;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "video_url" text;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;