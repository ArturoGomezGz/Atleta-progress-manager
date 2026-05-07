CREATE TABLE "athlete_session_exercise_cancelled" (
  "athlete_session_id" uuid NOT NULL REFERENCES "athlete_session"("id") ON DELETE CASCADE,
  "session_exercise_id" uuid NOT NULL REFERENCES "session_exercise"("id") ON DELETE CASCADE,
  PRIMARY KEY ("athlete_session_id", "session_exercise_id")
);
