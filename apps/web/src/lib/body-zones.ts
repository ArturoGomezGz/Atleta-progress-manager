import type { BodyZone } from "@atleta/db/body-zones"

export {
  deriveBodyZone,
  primaryZoneMix,
  zoneProfileFromContent,
  EMPTY_ZONE_PROFILE,
  type BaseBodyZone,
  type BodyZone,
  type ZoneProfile,
  type ZoneShare,
} from "@atleta/db/body-zones"

// Paleta por zona corporal (docs/ejercicios-schema.md §10). Única fuente de estos
// colores en la web: ejercicios, plantillas, sesiones y rutinas del atleta.
export const ZONE_CONFIG: Record<BodyZone, { bar: string; pill: string; text: string; label: string }> = {
  lower:     { bar: "bg-red-500",    pill: "bg-red-500/10 text-red-600 border-red-500/20",          text: "text-red-500",    label: "Inferior" },
  upper:     { bar: "bg-teal-500",   pill: "bg-teal-500/10 text-teal-600 border-teal-500/20",       text: "text-teal-500",   label: "Superior" },
  core:      { bar: "bg-amber-500",  pill: "bg-amber-500/10 text-amber-600 border-amber-500/20",    text: "text-amber-500",  label: "Core" },
  full_body: { bar: "bg-violet-500", pill: "bg-violet-500/10 text-violet-600 border-violet-500/20", text: "text-violet-500", label: "Full body" },
}
