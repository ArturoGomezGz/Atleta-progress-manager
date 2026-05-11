"use client"

import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light" | "system"
type ResolvedTheme = "dark" | "light"

const ThemeContext = createContext<{
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (t: Theme) => void
}>({ theme: "system", resolvedTheme: "dark", setTheme: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system")
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark")

  function applyTheme(t: Theme) {
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const resolved: ResolvedTheme = t === "system" ? (systemDark ? "dark" : "light") : t
    setResolvedTheme(resolved)
    document.documentElement.classList.remove("dark", "light")
    document.documentElement.classList.add(resolved)
  }

  // On mount: read stored preference
  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme | null) ?? "system"
    setThemeState(stored)
    applyTheme(stored)
  }, [])

  // When theme changes (except on mount which is handled above)
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Follow system changes when in "system" mode
  useEffect(() => {
    if (theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => applyTheme("system")
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [theme])

  function setTheme(t: Theme) {
    setThemeState(t)
    if (t === "system") {
      localStorage.removeItem("theme")
    } else {
      localStorage.setItem("theme", t)
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
