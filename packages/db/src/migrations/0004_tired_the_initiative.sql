ALTER TABLE "user_preferences" ADD COLUMN "onboarding_seen_at" timestamp;--> statement-breakpoint
-- Backfill: user_preferences solo tiene fila si el usuario ya tocó sus preferencias,
-- así que hay que insertar (o actualizar) una fila por cada usuario existente marcando
-- la bienvenida como "ya vista". Si no, toda la base instalada vería el onboarding.
INSERT INTO "user_preferences" ("user_id", "onboarding_seen_at")
SELECT "id", now() FROM "user"
ON CONFLICT ("user_id") DO UPDATE SET "onboarding_seen_at" = now();