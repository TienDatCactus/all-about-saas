import { createFileRoute } from "@tanstack/react-router"
import EditSessionPage from "@/pages/badminton/edit"
import i18n from "@/lib/i18n"

export const Route = createFileRoute("/_authenticated/badminton/$sessionId")({
  staticData: { crumb: () => i18n.t("badminton.edit.crumb") },
  component: RouteComponent,
})

function RouteComponent() {
  const { sessionId } = Route.useParams()
  return <EditSessionPage sessionId={sessionId} />
}
