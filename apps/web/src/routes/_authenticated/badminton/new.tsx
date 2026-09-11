import NewSessionPage from "@/pages/badminton/new"
import { createFileRoute } from "@tanstack/react-router"
import i18n from "@/lib/i18n"

export const Route = createFileRoute("/_authenticated/badminton/new")({
  staticData: { crumb: () => i18n.t("badminton.new.title") },
  component: NewSessionPage,
})
