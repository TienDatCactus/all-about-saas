"use client"

import { Link } from "@tanstack/react-router"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Kbd } from "../ui/kbd"

function randomHex() {
  return `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0")
    .toUpperCase()}`
}

export type ErrorPageProps = {
  code?: string
  title?: string
  description?: string
  className?: string
  onRetry?: () => void
}

/**
 * Blurred-gradient error page, cloned from hexful.com/404 — the mesh
 * background hue follows a hex the visitor can reroll (click or Space).
 */
export function ErrorPage({
  code = "404",
  title = "Page not found",
  description = "That link isn’t available. Head home, open a random color, or try hitting space to change your colour.",
  className,
  onRetry,
}: ErrorPageProps) {
  const [color, setColor] = useState("#6E06BE")

  const reroll = useCallback(() => setColor(randomHex()), [])

  useEffect(() => {
    reroll()
  }, [reroll])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return
      const target = event.target as HTMLElement | null
      if (target?.closest("input, textarea, button, a, select")) return
      event.preventDefault()
      reroll()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [reroll])

  return (
    <div
      className={cn(
        "relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden px-4",
        className
      )}
      style={{
        background: `radial-gradient(120% 90% at 20% 15%, ${color}55, transparent 60%),
          radial-gradient(110% 90% at 85% 20%, ${color}40, transparent 55%),
          radial-gradient(140% 100% at 50% 100%, ${color}33, transparent 60%),
          var(--background)`,
        transition: "background 500ms ease",
      }}
    >
      <div className="relative z-10 flex flex-col items-center text-center">
        <span
          className="bg-clip-text font-heading text-8xl leading-none font-bold text-transparent sm:text-9xl"
          style={{
            backgroundImage: `linear-gradient(135deg, ${color}, ${color}99)`,
          }}
        >
          {code}
        </span>
        <h1 className="mt-6 text-2xl font-semibold text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
          {description.split("space").map((part, i, arr) =>
            i === arr.length - 1 ? (
              part
            ) : (
              <span key={i}>
                {part}
                <Kbd>space</Kbd>
              </span>
            )
          )}
        </p>
        <div className="mt-6 flex items-center gap-2">
          {onRetry ? (
            <Button className="rounded-full" onClick={onRetry}>
              Try again
            </Button>
          ) : (
            <Button asChild className="rounded-full">
              <Link to="/">Go home</Link>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={reroll}
            aria-label={`Open ${color} in the mixer`}
          >
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            {color}
          </Button>
        </div>
      </div>
    </div>
  )
}
