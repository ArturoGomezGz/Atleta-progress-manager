CREATE TYPE "public"."routine_category" AS ENUM('evaluation', 'training');--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN "category" "routine_category" DEFAULT 'training' NOT NULL;