import { computeSplit } from "@repo/badminton-calc"
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
  const publicQuery = usePublicSessionQuery(shareToken)

  return (
    <DataPage
      query={publicQuery}
      title={(session) => session?.title || "Badminton split"}
      description={(session) => (session ? session.playedOn : " ")}
      loading={<Skeleton className="h-80 w-full rounded-xl" />}
      error={{
        title: "Split not found",
        description: "This share link is invalid or the session was removed.",
        content: null,
      }}
    >
      {(session) => (
        <div className="w-full">
          <BadmintonSummary
            computed={toComputed(session)}
            meta={{ title: session.title, playedOn: session.playedOn }}
          />
        </div>
      )}
    </DataPage>
  )
}
