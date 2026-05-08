import { db } from "@atleta/db/client"
import { athleteExerciseRm, exercise, exerciseProgressReport } from "@atleta/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { generateExerciseProgressReport } from "./ai-reports"

export async function triggerExerciseReport(params: {
  athleteId: string
  exerciseId: string
  teamId: string
  triggerRmId: string
}): Promise<void> {
  const { athleteId, exerciseId, teamId, triggerRmId } = params

  const [ex] = await db.select({ name: exercise.name }).from(exercise).where(eq(exercise.id, exerciseId)).limit(1)
  if (!ex) return

  const history = await db
    .select({
      id: athleteExerciseRm.id,
      rmLbs: athleteExerciseRm.rmLbs,
      recordedAt: athleteExerciseRm.recordedAt,
      source: athleteExerciseRm.source,
    })
    .from(athleteExerciseRm)
    .where(and(eq(athleteExerciseRm.athleteId, athleteId), eq(athleteExerciseRm.exerciseId, exerciseId)))
    .orderBy(desc(athleteExerciseRm.recordedAt))

  if (history.length === 0) return

  const content = await generateExerciseProgressReport({
    exerciseName: ex.name,
    current: history[0],
    history: [...history].reverse(),
  })

  await db
    .insert(exerciseProgressReport)
    .values({ athleteId, exerciseId, teamId, content, reportSource: "ai", seenAt: null, generatedAt: new Date(), triggerRmId })
    .onConflictDoUpdate({
      target: [exerciseProgressReport.athleteId, exerciseProgressReport.exerciseId],
      set: { content, reportSource: "ai", seenAt: null, generatedAt: new Date(), triggerRmId },
    })
}
