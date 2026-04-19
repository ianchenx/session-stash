import { useEffect, useState } from "react"

import {
  DEFAULT_THEME,
  getTheme,
  onThemeChange,
  setTheme as persistTheme,
  type Theme
} from "./theme"

type ResolvedTheme = "light" | "dark"

function resolveSystem(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "light"
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function applyClass(effective: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle("dark", effective === "dark")
  root.classList.toggle("light", effective === "light")
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME)
  const [effective, setEffective] = useState<ResolvedTheme>(() =>
    resolveSystem()
  )

  useEffect(() => {
    let cancelled = false
    void getTheme().then((value) => {
      if (!cancelled) {
        setThemeState(value)
      }
    })
    const unsubscribe = onThemeChange((value) => {
      setThemeState(value)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const compute = (): ResolvedTheme =>
      theme === "system" ? resolveSystem() : theme
    const initial = compute()
    setEffective(initial)
    applyClass(initial)

    if (theme !== "system") {
      return
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => {
      const next = resolveSystem()
      setEffective(next)
      applyClass(next)
    }
    media.addEventListener("change", handler)
    return () => media.removeEventListener("change", handler)
  }, [theme])

  return {
    theme,
    effective,
    setTheme: (next: Theme) => {
      setThemeState(next)
      void persistTheme(next)
    }
  }
}
