import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import { ScriptOnce } from "@tanstack/react-router"
import { storage } from "@/lib/utils/local-storage"

type Theme = "dark" | "light" | "system"
type ResolvedTheme = "dark" | "light"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  isDarkMode: boolean
}

const MEDIA_QUERY = "(prefers-color-scheme: dark)"

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system"
}

function getStoredTheme(storageKey: string, defaultTheme: Theme): Theme {
  const stored = storage.get(storageKey)

  return isTheme(stored) ? stored : defaultTheme
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme !== "system") {
    return theme
  }

  return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light"
}

/**
 * Applies the resolved theme to the document root.
 * This function must only run in the browser.
 */
function applyTheme(theme: Theme): ResolvedTheme {
  const resolved = resolveTheme(theme)
  const root = document.documentElement

  root.classList.remove("light", "dark")
  root.classList.add(resolved)
  root.style.colorScheme = resolved

  return resolved
}

/**
 * Runs before the application renders to prevent theme flashing.
 *
 * Keep this logic synchronized with resolveTheme() and applyTheme().
 */
function getThemeScript(storageKey: string, defaultTheme: Theme) {
  const key = JSON.stringify(storageKey)
  const fallback = JSON.stringify(defaultTheme)

  return `
    (function () {
      try {
        var stored = localStorage.getItem(${key});
        var theme =
          stored === "light" ||
          stored === "dark" ||
          stored === "system"
            ? stored
            : ${fallback};

        var resolved =
          theme === "system"
            ? (window.matchMedia("${MEDIA_QUERY}").matches ? "dark" : "light")
            : theme;

        var root = document.documentElement;

        root.classList.remove("light", "dark");
        root.classList.add(resolved);
        root.style.colorScheme = resolved;
      } catch (_) {}
    })();
  `
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined
)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme",
}: ThemeProviderProps) {
  // Initialize from storage immediately in the browser.
  // The bootstrap script handles the visual theme before React mounts.
  const [theme, setThemeState] = useState<Theme>(defaultTheme)

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (typeof document !== "undefined") {
      const appliedTheme = document.documentElement.classList.contains("dark")
        ? "dark"
        : document.documentElement.classList.contains("light")
          ? "light"
          : null

      if (appliedTheme) {
        return appliedTheme
      }
    }

    if (typeof window === "undefined") {
      return defaultTheme === "dark" ? "dark" : "light"
    }

    return resolveTheme(getStoredTheme(storageKey, defaultTheme))
  })

  useEffect(() => {
    const stored = storage.get<Theme>(storageKey)

    const nextTheme =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : defaultTheme

    setThemeState(nextTheme)
  }, [defaultTheme, storageKey])

  const setTheme = useCallback(
    (nextTheme: Theme) => {
      storage.set(storageKey, nextTheme)

      // Apply immediately instead of waiting for useEffect.
      const resolved = applyTheme(nextTheme)

      setResolvedTheme(resolved)
      setThemeState(nextTheme)
    },
    [storageKey]
  )

  // Keep the DOM synchronized when the preference changes externally,
  // or when the provider configuration changes.
  useEffect(() => {
    const storedTheme = getStoredTheme(storageKey, defaultTheme)

    setThemeState(storedTheme)
    setResolvedTheme(applyTheme(storedTheme))
  }, [defaultTheme, storageKey])

  // Follow OS/browser preference only when the selected theme is "system".
  useEffect(() => {
    if (theme !== "system") {
      return
    }

    const media = window.matchMedia(MEDIA_QUERY)

    const handleChange = () => {
      setResolvedTheme(applyTheme("system"))
    }

    media.addEventListener("change", handleChange)

    return () => {
      media.removeEventListener("change", handleChange)
    }
  }, [theme])

  // Synchronize changes made in another browser tab.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) {
        return
      }

      const nextTheme = isTheme(event.newValue) ? event.newValue : defaultTheme

      setThemeState(nextTheme)
      setResolvedTheme(applyTheme(nextTheme))
    }

    window.addEventListener("storage", handleStorage)

    return () => {
      window.removeEventListener("storage", handleStorage)
    }
  }, [defaultTheme, storageKey])

  const value: ThemeProviderState = {
    theme,
    resolvedTheme,
    setTheme,
    isDarkMode: resolvedTheme === "dark",
  }

  return (
    <ThemeProviderContext.Provider value={value}>
      <ScriptOnce>{getThemeScript(storageKey, defaultTheme)}</ScriptOnce>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }

  return context
}
