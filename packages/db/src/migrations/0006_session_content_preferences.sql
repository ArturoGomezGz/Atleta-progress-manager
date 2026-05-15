-- Snapshot del contenido de la rutina en la sesión (Opción 2)
--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN IF NOT EXISTS "content" jsonb;

-- Preferencias de usuario (rest timer, etc.)
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_preferences" (
  "user_id" text PRIMARY KEY NOT NULL,
  "rest_timer_enabled" boolean NOT NULL DEFAULT false,
  "rest_timer_seconds" integer NOT NULL DEFAULT 90,
  CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);
