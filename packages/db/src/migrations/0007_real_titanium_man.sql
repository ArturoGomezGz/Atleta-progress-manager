CREATE TYPE "public"."routine_kind" AS ENUM('warmup', 'main', 'recovery');--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN "kind" "routine_kind";--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "kind" "routine_kind";--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "scheduled_time" time;--> statement-breakpoint
CREATE INDEX "training_session_team_date_position_idx" ON "training_session" USING btree ("team_id","scheduled_date","position");--> statement-breakpoint
UPDATE "routine" SET "kind" = 'main' WHERE "category" = 'training' AND "kind" IS NULL;--> statement-breakpoint
UPDATE "training_session" ts SET "kind" = COALESCE(
  (SELECT r."kind" FROM "routine" r WHERE r."id" = ts."routine_id" AND r."category" = 'training'),
  'main'
) WHERE ts."kind" IS NULL AND NOT EXISTS (
  SELECT 1 FROM "routine" r WHERE r."id" = ts."routine_id" AND r."category" = 'evaluation'
);
