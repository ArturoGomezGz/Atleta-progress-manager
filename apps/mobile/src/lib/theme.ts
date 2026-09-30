// Misma paleta oscura y tipografía que la web (apps/web/src/app/globals.css y
// apps/web/src/app/layout.tsx): Inter para el texto y Barlow Condensed para títulos.
export const colors = {
  background: "#08090c",
  foreground: "#e5eaf0",
  card: "#14181f",
  primary: "#478eff",
  primaryForeground: "#ffffff",
  primarySoft: "rgba(71,142,255,0.12)",
  primaryBorder: "rgba(71,142,255,0.35)",
  secondary: "#222935",
  muted: "#222935",
  mutedSoft: "rgba(34,41,53,0.5)",
  mutedForeground: "#8f9cae",
  border: "#2e3642",
  input: "#1b1f28",
  destructive: "#ef4343",
  destructiveSoft: "rgba(239,67,67,0.12)",
  destructiveBorder: "rgba(239,67,67,0.6)",
  success: "#10b981",
  successSoft: "rgba(16,185,129,0.12)",
  successBorder: "rgba(16,185,129,0.6)",
  warning: "#f59e0b",
  warningSoft: "rgba(245,158,11,0.1)",
  warningBorder: "rgba(245,158,11,0.35)",
}

export const radius = 12
export const radiusLg = 16

// Con fuentes propias en Android no se usa `fontWeight`: cada peso es su propia familia.
export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  heading: "BarlowCondensed_700Bold",
  headingSemibold: "BarlowCondensed_600SemiBold",
}
