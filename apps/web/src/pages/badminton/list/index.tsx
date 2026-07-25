import { PlusIcon, UsersIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { formatVnd } from "@/lib/badminton/format";
import { useSessionsQuery } from "@/services/badminton/queries";
import { PageHeader, PageShell } from "../components/page-shell";

export default function SessionListPage() {
  const { data, isLoading } = useSessionsQuery();

  return (
    <PageShell>
      <PageHeader
        title="Badminton sessions"
        description="Your saved splits."
        actions={
          <Button asChild>
            <Link to="/badminton/new">
              <PlusIcon data-icon="inline-start" />
              New session
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>No sessions yet</EmptyTitle>
            <EmptyDescription>
              Create your first session to split court and shuttle costs.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link to="/badminton/new">
                <PlusIcon data-icon="inline-start" />
                New session
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((session) => {
            const total =
              session.computed?.grandTotal ??
              session.courtCost +
                session.shuttleUnitPrice *
                  (session.participants?.reduce(
                    (a, p) => a + p.shuttleCount,
                    0,
                  ) ?? 0);
            const players =
              session.computed?.rows.length ??
              session.participants?.length ??
              0;
            return (
              <li key={session.id}>
                <Link
                  to="/badminton/$sessionId"
                  params={{ sessionId: session.id }}
                  className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Card className="h-full transition-colors hover:border-ring">
                    <CardHeader>
                      <CardTitle className="truncate">
                        {session.title || "Untitled session"}
                      </CardTitle>
                      <CardDescription>{session.playedOn}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                      <span className="text-lg font-semibold tabular-nums">
                        {formatVnd(total)} ₫
                      </span>
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <UsersIcon />
                        {players}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
