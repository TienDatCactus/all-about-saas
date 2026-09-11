import { computeSplit } from "@repo/badminton-calc"
import { useTranslation } from "react-i18next"
import { BadmintonSummary } from "../components/Summary"
import type { PublicSession } from "@/services/badminton/types"
import DataPage from "@/components/custom/data/page"
import { Skeleton } from "@/components/ui/skeleton"
import { usePublicSessionQuery } from "@/services/badminton/queries"

function toComputed(session: PublicSession) {
  if (session.computed) return session.computed
  // Fallback: recompute from inputs if the stored snapshot is missing.
  return computeSplit({
    courtCost: session.courtCost,
    shuttleUnitPrice: session.shuttleUnitPrice,
    totalShuttleCount: session.totalShuttleCount,
    participants: session.participants.map((p) => ({
      id: p.id,
      name: p.name,
      hoursPlayed: p.hoursPlayed,
      shuttleWeight: p.shuttleWeight,
    })),
  })
}

export default function BadmintonSummaryPage({
  shareToken,
}: {
  shareToken: string
}) {
  const { t } = useTranslation()
  const publicQuery = usePublicSessionQuery(shareToken)

  return (
    <DataPage
      query={publicQuery}
      title={(session) => session?.title || t("badminton.share.defaultTitle")}
      description={(session) => (session ? session.playedOn : " ")}
      loading={<Skeleton className="h-80 w-full rounded-xl" />}
      error={{
        title: t("badminton.share.notFound.title"),
        description: t("badminton.share.notFound.description"),
        content: null,
      }}
    >
      {(session) => (
        <div className="w-full">
          <BadmintonSummary
            computed={toComputed(session)}
            meta={{
              title: session.title,
              playedOn: session.playedOn,
              totalShuttleCount: session.totalShuttleCount,
              defaultHoursPlayed: session.defaultHoursPlayed,
            }}
            paymentMethod={session.paymentMethod ?? null}
            paymentStatus={Object.fromEntries(
              session.participants.map((p) => [p.id, { paid: p.paid }])
            )}
          />
        </div>
      )}
    </DataPage>
  )
}
