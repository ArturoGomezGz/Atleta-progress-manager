"use client"

// Feature flags por usuario (ver docs/feature-flags.md). Las claves vienen de la
// API (`features.mine`); mientras carga o si falla, todo cuenta como NO activo
// para no mostrar de golpe contenido que luego se oculta.

import type { FeatureKey } from "@atleta/api/features"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { trpc } from "./trpc/client"

// Las claves se importan de la API: no hay lista duplicada en la web
export type { FeatureKey }

export function useFeatures() {
  const { data, isLoading } = trpc.features.mine.useQuery(undefined, { staleTime: 5 * 60_000 })
  return {
    isLoading,
    has: (key: FeatureKey) => data?.includes(key) ?? false,
  }
}

export function useFeature(key: FeatureKey): boolean {
  return useFeatures().has(key)
}

// Para rutas ocultas: sin el flag redirige a la página principal del equipo
export function FeatureGate({ feature, teamId, children }: { feature: FeatureKey; teamId: string; children: React.ReactNode }) {
  const router = useRouter()
  const { isLoading, has } = useFeatures()
  const allowed = has(feature)

  useEffect(() => {
    if (!isLoading && !allowed) router.replace(`/teams/${teamId}/equipo`)
  }, [isLoading, allowed, router, teamId])

  return allowed ? <>{children}</> : null
}
