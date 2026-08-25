import { useNavigate } from "@tanstack/react-router"
import { PageShell } from "../../../components/custom/page-shell"
import { PageHeader } from "../../../components/custom/page-shell/page-header"
import { SessionEditor } from "../components/session-editor"

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
