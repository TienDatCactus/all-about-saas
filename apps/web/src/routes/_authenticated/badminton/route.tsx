import { MagnifyingGlassIcon } from "@phosphor-icons/react"
import { Outlet, createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import DataEmpty from "@/components/custom/data/empty"
import DataError from "@/components/custom/data/error"
import { Button } from "@/components/ui/button"
import i18n from "@/lib/i18n"

export const Route = createFileRoute("/_authenticated/badminton")({
  staticData: { crumb: () => i18n.t("badminton.crumb") },
  component: () => <Outlet />,
  notFoundComponent: () => {
    const { t } = useTranslation()
    return (
      <DataEmpty
        media={{ variant: "icon", icon: <MagnifyingGlassIcon /> }}
        title={t("badminton.notFoundRoute.title")}
        description={t("badminton.notFoundRoute.description")}
      />
    )
  },
  errorComponent: ({ error, reset }) => {
    const { t } = useTranslation()
    return (
      <DataError
        title={t("badminton.errorRoute.title")}
        description={error.message || t("badminton.errorRoute.description")}
        content={
          <Button variant="outline" onClick={() => reset()}>
            {t("badminton.errorRoute.tryAgain")}
          </Button>
        }
      />
    )
  },
})
