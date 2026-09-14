import { DumbbellIcon, ZapIcon, type LucideIcon } from "lucide-react"

export type RoutineCategory = "evaluation" | "training"

export type RoutineTypeConfig = {
  label: string
  icon: LucideIcon
  // Tailwind color classes
  text: string       // icon + label color
  bg: string         // pill/badge background
  border: string     // pill/badge border
  ring: string       // selected card ring
  dot: string        // indicator dot
  leftBar: string    // card left accent bar
}

export const ROUTINE_TYPE_CONFIG: Record<RoutineCategory, RoutineTypeConfig> = {
  evaluation: {
    label:   "Evaluación",
    icon:    ZapIcon,
    text:    "text-violet-400",
    bg:      "bg-violet-500/10",
    border:  "border-violet-500/25",
    ring:    "ring-violet-500/30 border-violet-500/40",
    dot:     "bg-violet-400",
    leftBar: "bg-violet-500",
  },
  training: {
    label:   "Entrenamiento",
    icon:    DumbbellIcon,
    text:    "text-sky-400",
    bg:      "bg-sky-500/10",
    border:  "border-sky-500/25",
    ring:    "ring-sky-500/30 border-sky-500/40",
    dot:     "bg-sky-400",
    leftBar: "bg-sky-500",
  },
}

export function getRoutineTypeConfig(category: string): RoutineTypeConfig {
  return ROUTINE_TYPE_CONFIG[category as RoutineCategory] ?? {
    label:   category,
    icon:    DumbbellIcon,
    text:    "text-muted-foreground",
    bg:      "bg-muted/20",
    border:  "border-border",
    ring:    "ring-border border-border",
    dot:     "bg-muted-foreground",
    leftBar: "bg-muted-foreground",
  }
}
