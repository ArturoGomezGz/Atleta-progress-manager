"use client"

import { useSession } from "@/lib/auth"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { ChevronDownIcon, ChevronUpIcon, PencilIcon } from "lucide-react"
import { use, useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const PCT_LEVELS = [90, 80, 75, 70]

export default function ProgresoPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  const { data: session } = useSession()
  const { data: teams } = trpc.teams.list.useQuery()

  const myRole = teams?.find((t) => t.team.id === teamId)?.role

  // Athletes see only their own progress, no selector
  if (myRole === "athlete" && session) {
    return (
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
        <h1 className="font-semibold text-xl mb-6">Mi progreso</h1>
        <AthleteRms teamId={teamId} athleteId={session.user.id} isCoach={false} />
      </div>
    )
  }

  return <CoachProgresoView teamId={teamId} />
}

function CoachProgresoView({ teamId }: { teamId: string }) {
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null)
  const { data: athletes } = trpc.rms.athletes.useQuery({ teamId })

  const activeAthleteId = selectedAthleteId ?? athletes?.[0]?.id ?? null

  return (
    <div className="flex h-[calc(100vh-57px)]">
      <aside className="w-48 border-r flex flex-col overflow-y-auto shrink-0">
        <p className="text-xs font-medium text-muted-foreground px-4 py-3 uppercase tracking-wide">Atletas</p>
        {athletes?.length === 0 && (
          <p className="px-4 text-xs text-muted-foreground">Sin atletas</p>
        )}
        {athletes?.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelectedAthleteId(a.id)}
            className={cn(
              "text-left px-4 py-3 text-sm border-b last:border-0 hover:bg-muted/50 transition-colors",
              a.id === activeAthleteId && "bg-muted font-medium",
            )}
          >
            {a.name}
          </button>
        ))}
      </aside>
      <div className="flex-1 overflow-y-auto p-6">
        {activeAthleteId ? (
          <AthleteRms teamId={teamId} athleteId={activeAthleteId} isCoach={true} />
        ) : (
          <p className="text-sm text-muted-foreground">Selecciona un atleta</p>
        )}
      </div>
    </div>
  )
}

function AthleteRms({ teamId, athleteId, isCoach }: { teamId: string; athleteId: string; isCoach: boolean }) {
  const { data: rmGroups, refetch } = trpc.rms.listByAthlete.useQuery({ teamId, athleteId })
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (!rmGroups) return <p className="text-sm text-muted-foreground">Cargando...</p>
  if (rmGroups.length === 0) return <p className="text-sm text-muted-foreground">Sin PRs registrados.</p>

  return (
    <div className="space-y-2 max-w-2xl">
      <h2 className="font-semibold mb-4">PRs registrados</h2>
      {rmGroups.map((group) => (
        <ExerciseRmRow
          key={group.exerciseId}
          teamId={teamId}
          athleteId={athleteId}
          group={group}
          isCoach={isCoach}
          expanded={expandedId === group.exerciseId}
          onToggle={() => setExpandedId(expandedId === group.exerciseId ? null : group.exerciseId)}
          onSaved={refetch}
        />
      ))}
    </div>
  )
}

type RmEntry = {
  id: string
  rmLbs: string
  source: "auto" | "manual"
  sessionId: string | null
  recordedAt: string
}

type RmGroup = {
  exerciseId: string
  exerciseName: string
  current: RmEntry
  history: RmEntry[]
}

function ExerciseRmRow({
  teamId,
  athleteId,
  group,
  isCoach,
  expanded,
  onToggle,
  onSaved,
}: {
  teamId: string
  athleteId: string
  group: RmGroup
  isCoach: boolean
  expanded: boolean
  onToggle: () => void
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const setManual = trpc.rms.setManual.useMutation({
    onSuccess: () => { setEditing(false); onSaved() },
  })

  const currentRm = Number(group.current.rmLbs)

  // Chart data: history ordered chronologically (oldest → newest)
  const chartData = [...group.history]
    .reverse()
    .map((e) => ({
      date: new Date(e.recordedAt).toLocaleDateString("es", { day: "2-digit", month: "short", year: "2-digit" }),
      rm: Number(e.rmLbs),
      source: e.source,
    }))

  function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editValue) return
    setManual.mutate({ teamId, athleteId, exerciseId: group.exerciseId, rmLbs: editValue })
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/20">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{group.exerciseName}</p>
          <p className="text-xs text-muted-foreground">
            {group.history.length} registro{group.history.length !== 1 ? "s" : ""}
          </p>
        </div>

        {isCoach && editing ? (
          <form onSubmit={handleEdit} className="flex items-center gap-1.5">
            <input
              autoFocus
              type="number"
              min={0}
              step={0.5}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={group.current.rmLbs}
              className="w-20 border border-border rounded-md px-2 py-1 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground">lbs</span>
            <button
              type="submit"
              disabled={setManual.isPending || !editValue}
              className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50"
            >
              {setManual.isPending ? "..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-muted-foreground hover:text-foreground px-1"
            >
              Cancelar
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tabular-nums">{group.current.rmLbs} lbs</span>
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded",
              group.current.source === "auto" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700",
            )}>
              {group.current.source === "auto" ? "auto" : "manual"}
            </span>
            {isCoach && (
              <button
                onClick={() => { setEditValue(""); setEditing(true) }}
                className="p-1 text-muted-foreground hover:text-foreground rounded"
              >
                <PencilIcon className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={onToggle} className="p-1 text-muted-foreground hover:text-foreground rounded">
              {expanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="divide-y">
          {/* RM evolution chart */}
          <div className="px-4 py-4">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Evolución del PR</p>
            {chartData.length < 2 ? (
              <p className="text-xs text-muted-foreground py-2">
                Se necesitan al menos 2 registros para mostrar la evolución.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    domain={["auto", "auto"]}
                    unit=" lbs"
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 6,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--background))",
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: number, _: string, entry: { payload: { source: string } }) => [
                      `${value} lbs`,
                      entry.payload.source === "auto" ? "auto" : "manual",
                    ]}
                    labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  />
                  <ReferenceLine
                    y={currentRm}
                    stroke="hsl(var(--primary))"
                    strokeDasharray="4 4"
                    strokeOpacity={0.4}
                  />
                  <Line
                    type="monotone"
                    dataKey="rm"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={(props) => {
                      const { cx, cy, payload } = props
                      return (
                        <circle
                          key={`dot-${cx}-${cy}`}
                          cx={cx}
                          cy={cy}
                          r={4}
                          fill={payload.source === "auto" ? "hsl(var(--primary))" : "hsl(43 96% 56%)"}
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                        />
                      )
                    }}
                    activeDot={{ r: 5 }}
                    name="RM"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />
                <span className="text-xs text-muted-foreground">auto</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                <span className="text-xs text-muted-foreground">manual</span>
              </div>
            </div>
          </div>

          {/* Percentages */}
          <div className="px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Cargas por porcentaje</p>
            <div className="grid grid-cols-4 gap-2">
              {PCT_LEVELS.map((pct) => (
                <div key={pct} className="text-center border rounded-md py-2 px-1 bg-muted/10">
                  <p className="text-xs text-muted-foreground">{pct}%</p>
                  <p className="text-sm font-semibold tabular-nums">{(currentRm * pct / 100).toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">lbs</p>
                </div>
              ))}
            </div>
          </div>

          {/* History list */}
          <div className="px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Historial</p>
            <div className="space-y-1">
              {group.history.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 text-xs">
                  <span className="tabular-nums font-medium">{entry.rmLbs} lbs</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded",
                    entry.source === "auto" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700",
                  )}>
                    {entry.source}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(entry.recordedAt).toLocaleDateString("es", { dateStyle: "medium" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
