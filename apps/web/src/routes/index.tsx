import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { authApi } from "@/services/auth"
import { PageShell } from "@/components/custom/page-shell"

export const Route = createFileRoute("/")({
  component: App,
})

function App() {
  return (
    <PageShell>
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Project ready!</h1>
          <p>You may now add components and start building.</p>
          <p>We&apos;ve already added the button component for you.</p>
        </div>
        <Button
          onClick={() => {
            // Dev scratch button: fire the refresh call and ignore the result.
            void authApi.refresh()
          }}
        >
          dat
        </Button>
      </div>
    </PageShell>
  )
}
