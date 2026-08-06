import { useNavigate } from "@tanstack/react-router"
import { SessionEditor } from "../components/SessionEditor"
import { PageShell } from "../../../components/custom/page-shell"
import { PageHeader } from "../../../components/custom/page-shell/page-header"

export default function NewSessionPage() {
  const navigate = useNavigate()

  return (
    <PageShell>
      <PageHeader
        title="New session"
        description="Enter the costs and players — the split updates live."
      />
      <SessionEditor
        onSaved={(session) => {
          void navigate({
            to: "/badminton/$sessionId",
            params: { sessionId: session.id },
          })
        }}
      />
    </PageShell>
  )
}
