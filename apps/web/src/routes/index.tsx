import ClickSpark from "@/components/click-spark"
import type { ConfettiRef } from "@/components/custom/confetti"
import { Confetti } from "@/components/custom/confetti"
import { PageShell } from "@/components/custom/page-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlienIcon, ConfettiIcon } from "@phosphor-icons/react"
import { createFileRoute } from "@tanstack/react-router"
import { useRef } from "react"

export const Route = createFileRoute("/")({
  component: App,
})

function App() {
  const confettiRef = useRef<ConfettiRef>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  async function onClick() {
    if (!inputRef.current?.value) {
      return
    }
    await confettiRef.current?.fire({ particleCount: 100, spread: 70 })
  }
  return (
    <ClickSpark
      sparkColor="oklch(0.5 0.134 242.749)"
      sparkCount={12}
      sparkSize={6}
      sparkRadius={20}
    >
      <PageShell>
        <div className="absolute inset-0 bg-[radial-gradient(rgba(0,0,0,0.1)_1px,transparent_1px)] bg-[size:16px_16px] dark:bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)]" />
        <div className="z-10 m-auto flex flex-col items-center gap-6 text-center">
          <Badge variant="outline">
            <AlienIcon />
            Salam malaykum
          </Badge>
          <h2 className="text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
            Welcome to All About SaaS
          </h2>
          <p className="max-w-xl text-base text-balance text-muted-foreground sm:text-lg">
            This is a SaaS boilerplate built with React, TypeScript, and
            Tailwind CSS. It includes authentication, authorization, and a user
            dashboard. You can use it as a starting point for your own SaaS
            projects.
          </p>
          <div className="stack-row w-96 gap-2">
            <Input
              ref={inputRef}
              placeholder="Enter your email so we can celebrate yo shi!"
              className="flex-1"
            />
            <Button onClick={onClick}>
              Save
              <ConfettiIcon />
            </Button>
          </div>
        </div>
        <Confetti
          ref={confettiRef}
          manualstart
          className="pointer-events-none absolute inset-0 z-50 size-full"
        />
      </PageShell>
    </ClickSpark>
  )
}
