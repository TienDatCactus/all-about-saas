import DataPage from "@/components/custom/data/page"
import { Skeleton } from "@/components/ui/skeleton"
import { useSessionQuery } from "@/services/badminton/queries"
import { ShareLink } from "../components/ShareLink"
import { SessionEditor } from "../components/SessionEditor"
import { sessionToValues } from "../lib/form"

export default function EditSessionPage({ sessionId }: { sessionId: string }) {
  const sessionQuery = useSessionQuery(sessionId)

  return (
    <DataPage
      query={sessionQuery}
      title={(session) => session?.title || "Session"}
      description={(session) => (session ? session.playedOn : " ")}
      loading={<EditorSkeleton />}
      error={{
        title: "Session not found",
        description:
          "It may have been deleted, or you don't have access to it.",
        content: null,
      }}
    >
      {(session) => (
        <>
          <ShareLink shareToken={session.shareToken} />
          <SessionEditor
            sessionId={sessionId}
            initialValues={sessionToValues(session)}
          />
        </>
      )}
    </DataPage>
  )
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
  )
}
