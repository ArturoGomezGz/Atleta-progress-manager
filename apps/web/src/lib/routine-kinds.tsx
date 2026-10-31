import { cn } from "@/lib/utils"

export type RoutineKind = "warmup" | "main" | "recovery"

export const ROUTINE_KINDS: RoutineKind[] = ["warmup", "main", "recovery"]

export const KIND_LABEL: Record<RoutineKind, string> = {
  warmup: "Calentamiento",
  main: "Principal",
  recovery: "Recuperación",
}

const KIND_STYLE: Record<RoutineKind, string> = {
  warmup: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  main: "bg-sky-500/10 text-sky-400 border-sky-500/25",
  recovery: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
}

/** Etiqueta de tipo; las evaluaciones (kind null) se muestran como "Evaluación". */
export function kindLabel(kind: string | null | undefined, category?: string | null): string | null {
  if (category === "evaluation") return "Evaluación"
  return kind && kind in KIND_LABEL ? KIND_LABEL[kind as RoutineKind] : null
}

export function KindBadge({ kind, category, className }: { kind?: string | null; category?: string | null; className?: string }) {
  const label = kindLabel(kind, category)
  if (!label) return null
  const style = category === "evaluation"
    ? "bg-violet-500/10 text-violet-400 border-violet-500/25"
    : KIND_STYLE[kind as RoutineKind]
  return (
    <span className={cn("inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0 whitespace-nowrap", style, className)}>
      {label}
    </span>
  )
}

/** Selector segmentado de 3 opciones. */
export function KindSelector({
  value, onChange, label = "Tipo de entrenamiento", disabled,
}: { value: RoutineKind; onChange: (k: RoutineKind) => void; label?: string; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1.5">
      {ROUTINE_KINDS.map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          disabled={disabled}
          onClick={() => onChange(k)}
          className={cn(
            "flex-1 py-2 text-xs rounded-lg border transition-colors cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
            value === k ? KIND_STYLE[k] : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {KIND_LABEL[k]}
        </button>
      ))}
    </div>
  )
}

/** Orden de sesiones del mismo día: por position y luego por hora sugerida. */
export function compareByPosition(
  a: { position?: number | null; scheduledTime?: string | null },
  b: { position?: number | null; scheduledTime?: string | null },
): number {
  return (a.position ?? 0) - (b.position ?? 0) || (a.scheduledTime ?? "99:99").localeCompare(b.scheduledTime ?? "99:99")
}
