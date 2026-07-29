import { WarningIcon } from "@phosphor-icons/react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionQuery } from "@/services/badminton/queries";
import { PageHeader, PageShell } from "../../../components/custom/page-shell";
import { ShareLink } from "../components/ShareLink";
import { SessionEditor } from "../components/SessionEditor";
import { sessionToValues } from "../lib/form";

export default function EditSessionPage({ sessionId }: { sessionId: string }) {
  const { data, isLoading, isError } = useSessionQuery(sessionId);

  return (
    <PageShell>
      <PageHeader
        title={data?.title || "Session"}
        description={data ? data.playedOn : " "}
      />

      {isLoading ? (
        <EditorSkeleton />
      ) : isError || !data ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WarningIcon />
            </EmptyMedia>
            <EmptyTitle>Session not found</EmptyTitle>
            <EmptyDescription>
              It may have been deleted, or you don&apos;t have access to it.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <ShareLink shareToken={data.shareToken} />
          <SessionEditor
            sessionId={sessionId}
            initialValues={sessionToValues(data)}
          />
        </>
      )}
    </PageShell>
  );
}

function EditorSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,26rem)]">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}
