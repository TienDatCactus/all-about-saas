"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"

import { cn } from "@/lib/utils"
import { MoonIcon, SunIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/lib/context/theme"

interface AnimatedThemeTogglerProps extends React.ComponentPropsWithoutRef<"button"> {
  duration?: number
}

export const ThemeToggler = ({
  className,
  duration = 600,
  ...props
}: AnimatedThemeTogglerProps) => {
  const { theme, setTheme } = useTheme()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = useCallback(() => {
    if (!buttonRef.current) return

    // "system" must be resolved before flipping, or an OS-dark user's first
    // click "switches" to the dark they are already looking at — a no-op with
    // a pointless transition.
    const resolvedDark =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : theme === "dark"
    const newTheme = resolvedDark ? "light" : "dark"

    if (document.startViewTransition) {
      document
        .startViewTransition(() => {
          flushSync(() => {
            setTheme(newTheme)
          })
        })
        .ready.then(() => {
          // Unmounted mid-transition (route change) leaves the ref null; the
          // theme is already applied, only the reveal animation is skipped.
          if (!buttonRef.current) return
          const { top, left, width, height } =
            buttonRef.current.getBoundingClientRect()
          const x = left + width / 2
          const y = top + height / 2
          const maxRadius = Math.hypot(
            Math.max(left, window.innerWidth - left),
            Math.max(top, window.innerHeight - top)
          )

          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${maxRadius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration,
              easing: "ease-in-out",
              pseudoElement: "::view-transition-new(root)",
            }
          )
        })
        // `.ready` rejects whenever the transition is skipped — hidden tab,
        // a second click starting a new transition, reduced-motion. The theme
        // itself already switched; only the reveal is lost, so swallow it
        // instead of surfacing an unhandled rejection.
        .catch(() => {})
    } else {
      setTheme(newTheme)
    }
  }, [theme, setTheme, duration])

  // Same "system" resolution as the toggle, gated on mounted so SSR never
  // touches window; pre-mount the fallback branch below renders regardless.
  const isDark =
    mounted &&
    (theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : theme === "dark")

  return (
    <Button
      variant="outline"
      size="icon"
      ref={buttonRef}
      onClick={toggleTheme}
      className={cn(className)}
      {...props}
    >
      {mounted ? (
        isDark ? (
          <SunIcon />
        ) : (
          <MoonIcon />
        )
      ) : (
        <MoonIcon aria-hidden="true" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
