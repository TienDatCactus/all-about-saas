import { Outlet, createFileRoute } from "@tanstack/react-router"
import i18n from "@/lib/i18n"

export const Route = createFileRoute("/_authenticated/badminton")({
  staticData: { crumb: () => i18n.t("badminton.crumb") },
  component: () => <Outlet />,
})
