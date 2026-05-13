CREATE TYPE "public"."exercise_suitable_for" AS ENUM('warmup', 'evaluation');

ALTER TABLE "exercise"
  ADD COLUMN "suitable_for" "exercise_suitable_for",
  DROP COLUMN "is_warmup_suitable",
  DROP COLUMN "is_evaluation_suitable";
