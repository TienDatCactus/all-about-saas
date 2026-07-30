import { PlusIcon, TrashIcon, UsersIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import DataCard from "@/components/custom/data/card";
import DataPage from "@/components/custom/data/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatVnd } from "@/pages/badminton/lib/format";
import {
  useSessionsQuery,
  useUndoableDeleteSession,
} from "@/services/badminton/queries";

export default function SessionListPage() {
  const sessionsQuery = useSessionsQuery();
  const deleteSession = useUndoableDeleteSession();
  return (
    <DataPage
      query={sessionsQuery}
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
      loading={
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      }
      error={{
        title: "Couldn't load your sessions",
        description:
          "Something went wrong fetching your saved splits. Check your connection and try again.",
      }}
      empty={{
        className: "border",
        media: { variant: "icon", icon: <UsersIcon /> },
        title: "No sessions yet",
        description:
          "Create your first session to split court and shuttle costs.",
        content: (
          <Button asChild>
            <Link to="/badminton/new">
              <PlusIcon data-icon="inline-start" />
              New session
            </Link>
          </Button>
        ),
      }}
    >
      {(sessions) => (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => {
            const total =
              session.computed?.grandTotal ??
              session.courtCost +
                session.shuttleUnitPrice * (session.totalShuttleCount ?? 0);
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
                  <DataCard
                    title={session.title || "Untitled session"}
                    description={session.playedOn}
                    content={
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold tabular-nums">
                          {formatVnd(total)} ₫
                        </span>
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <UsersIcon />
                          {players}
                        </span>
                      </div>
                    }
                    className="group smooth-transition hover:shadow-xl hover:-translate-y-0.5"
                    action={
                      <Button
                        variant="destructive"
                        size="icon"
                        aria-label="Delete session"
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteSession(session);
                        }}
                      >
                        <TrashIcon />
                      </Button>
                    }
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DataPage>
  );
}
