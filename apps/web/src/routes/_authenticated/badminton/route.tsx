import { MagnifyingGlassIcon } from "@phosphor-icons/react"
import { Outlet, createFileRoute, notFound } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import DataEmpty from "@/components/custom/data/empty"
import DataError from "@/components/custom/data/error"
import { Button } from "@/components/ui/button"
import { isFeatureEnabled } from "@/lib/features"
import i18n from "@/lib/i18n"

function BadmintonNotFound() {
  const { t } = useTranslation()
  return (
    <DataEmpty
      media={{ variant: "icon", icon: <MagnifyingGlassIcon /> }}
      title={t("common.routeNotFound.title")}
      description={t("badminton.notFound.description")}
    />
  )
}

function BadmintonError({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useTranslation()
  return (
    <DataError
      title={t("common.routeError.title")}
      description={error.message || t("common.routeError.description")}
      content={
        <Button variant="outline" onClick={() => reset()}>
          {t("common.routeError.tryAgain")}
        </Button>
      }
    />
  )
}

export const Route = createFileRoute("/_authenticated/badminton")({
  staticData: { crumb: () => i18n.t("badminton.crumb") },
  // Feature off: the section 404s, so a bookmarked or hand-typed URL
  // lands on the same not-found page as a bad child path.
  beforeLoad: () => {
    if (!isFeatureEnabled("badminton")) throw notFound()
  },
  component: () => <Outlet />,
  notFoundComponent: BadmintonNotFound,
  errorComponent: BadmintonError,
})
