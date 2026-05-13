-- Drop old FK (RESTRICT) and re-add with CASCADE so deleting an exercise
-- removes it from all routines automatically.
ALTER TABLE "routine_exercise" DROP CONSTRAINT "routine_exercise_exercise_id_exercise_id_fk";--> statement-breakpoint
ALTER TABLE "routine_exercise" ADD CONSTRAINT "routine_exercise_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;
