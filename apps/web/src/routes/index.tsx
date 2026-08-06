import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { authApi } from "@/services/auth"
import { PageShell } from "@/components/custom/page-shell"
import { Badge } from "@/components/ui/badge"
import { AlienIcon, ConfettiIcon } from "@phosphor-icons/react"
import { FormField } from "@/components/custom/form-field"
import { FieldGroup } from "@/components/ui/field"
import { useForm } from "@tanstack/react-form"
import { Input } from "@/components/ui/input"
import {
  Confetti,
  ConfettiButton,
  useConfetti,
  type ConfettiRef,
} from "@/components/custom/confetti"
import { useRef } from "react"

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
      confettiRef.current?.fire({ particleCount: 100, spread: 70 })
    },
  })
  return (
    <PageShell>
      <div className="absolute top-0 right-0 bottom-0 left-0 z-0 bg-[radial-gradient(#0000001a_1px,#f8fafc_1px)] bg-[size:16px_16px]"></div>
      <div className="z-10 m-auto flex flex-col items-center gap-6 text-center">
        <Badge variant="outline">
          <AlienIcon />
          Salam malaykum
        </Badge>
        <h2 className="text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
          Welcome to All About SaaS
        </h2>
        <p className="max-w-xl text-base text-balance text-muted-foreground sm:text-lg">
          This is a SaaS boilerplate built with React, TypeScript, and Tailwind
          CSS. It includes authentication, authorization, and a user dashboard.
          You can use it as a starting point for your own SaaS projects.
        </p>
        <form
          action=""
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
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
  )
}
