import { AlienIcon, ConfettiIcon } from "@phosphor-icons/react"
import { useForm } from "@tanstack/react-form"
import { createFileRoute } from "@tanstack/react-router"
import { useRef } from "react"
import type { ConfettiRef } from "@/components/custom/confetti"
import { Confetti } from "@/components/custom/confetti"
import { FormField } from "@/components/custom/form-field"
import { PageShell } from "@/components/custom/page-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import ClickSpark from "@/components/ClickSpark"

export const Route = createFileRoute("/")({
  component: App,
})

function App() {
  const confettiRef = useRef<ConfettiRef>(null)

  const form = useForm({
    defaultValues: {
      email: "",
    },
    onSubmit: async () => {
      await confettiRef.current?.fire({ particleCount: 100, spread: 70 })
    },
  })
  return (
    <ClickSpark
      sparkColor="oklch(0.5 0.134 242.749)"
      sparkCount={12}
      sparkSize={6}
      sparkRadius={20}
    >
      <PageShell>
        <div
          className="absolute inset-0 bg-[radial-gradient(rgba(0,0,0,0.1)_1px,transparent_1px)] bg-[size:16px_16px] dark:bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)]"
        />
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
          <form
            action=""
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
            className="w-96"
          >
            <div className="flex w-full gap-2">
              <FormField form={form} name="email">
                {({ inputProps }) => (
                  <Input
                    placeholder="Enter your email so we can celebrate yo shi!"
                    className="flex-1"
                    {...inputProps}
                  />
                )}
              </FormField>

              <Button>
                Save
                <ConfettiIcon />
              </Button>
            </div>
          </form>
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
