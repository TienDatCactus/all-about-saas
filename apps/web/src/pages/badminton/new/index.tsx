import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageShell } from "../../../components/custom/page-shell"
import { PageHeader } from "../../../components/custom/page-shell/page-header"
import { SessionEditor } from "../components/session-editor"

export default function NewSessionPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <PageShell>
      <PageHeader
        title={t("badminton.new.title")}
        description={t("badminton.new.description")}
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
