import { WarningIcon } from "@phosphor-icons/react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { computeSplit } from "@/pages/badminton/lib/calc";
import { usePublicSessionQuery } from "@/services/badminton/queries";
import type { PublicSession } from "@/services/badminton/types";
import { PageHeader, PageShell } from "../../../components/custom/page-shell";
import { BadmintonSummary } from "../components/Summary";

function toComputed(session: PublicSession) {
  if (session.computed) return session.computed;
  // Fallback: recompute from inputs if the stored snapshot is missing.
  return computeSplit({
    courtCost: session.courtCost,
    shuttleUnitPrice: session.shuttleUnitPrice,
    totalShuttleCount: session.totalShuttleCount,
    participants: session.participants.map((p) => ({
      id: p.id,
      name: p.name,
      courtFraction: p.courtFraction,
      discount: p.discount,
      shuttleFraction: p.shuttleFraction,
    })),
  });
}

export default function PublicSessionPage({
  shareToken,
}: {
  shareToken: string;
}) {
  const { data, isLoading, isError } = usePublicSessionQuery(shareToken);

  return (
    <PageShell>
      <PageHeader
        title={data?.title || "Badminton split"}
        description={data ? data.playedOn : " "}
      />

      {isLoading ? (
        <Skeleton className="h-80 w-full max-w-xl rounded-xl" />
      ) : isError || !data ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WarningIcon />
            </EmptyMedia>
            <EmptyTitle>Split not found</EmptyTitle>
            <EmptyDescription>
              This share link is invalid or the session was removed.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="max-w-xl">
          <BadmintonSummary
            computed={toComputed(data)}
            meta={{ title: data.title, playedOn: data.playedOn }}
          />
        </div>
      )}
    </PageShell>
  );
}
