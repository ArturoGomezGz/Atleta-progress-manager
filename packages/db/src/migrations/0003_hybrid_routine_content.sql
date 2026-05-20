-- Migración al schema híbrido: routine.content jsonb reemplaza routine_exercise + routine_set_target
-- Sin datos en producción — DROP limpio sin preservación de datos

--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN "content" jsonb DEFAULT '{"v":1,"items":[]}' NOT NULL;

--> statement-breakpoint
-- routine_set_target depende de routine_exercise, se elimina primero
DROP TABLE "routine_set_target";

--> statement-breakpoint
-- CASCADE elimina la FK constraint en athlete_set_completion.routine_exercise_id automáticamente
DROP TABLE "routine_exercise" CASCADE;

--> statement-breakpoint
ALTER TABLE "routine" DROP COLUMN "type";

--> statement-breakpoint
ALTER TABLE "routine" DROP COLUMN "circuit_rounds";

--> statement-breakpoint
ALTER TABLE "routine" DROP COLUMN "circuit_duration_seconds";

--> statement-breakpoint
DROP TYPE "public"."routine_type";

--> statement-breakpoint
DROP TYPE "public"."exercise_goal";

--> statement-breakpoint
DROP TYPE "public"."set_type";

--> statement-breakpoint
DROP TYPE "public"."load_type";
