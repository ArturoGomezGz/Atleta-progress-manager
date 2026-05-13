CREATE TABLE "exercise_save" (
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "exercise_id" uuid NOT NULL REFERENCES "exercise"("id") ON DELETE CASCADE,
  "saved_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "exercise_id")
);
