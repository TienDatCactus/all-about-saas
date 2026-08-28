import { PaymentMethodPicker } from "../components/PaymentMethodPicker"
import { ShareLink } from "../components/ShareLink"
import { SessionEditor } from "../components/session-editor"
import { sessionToValues } from "../lib/form"
import DataPage from "@/components/custom/data/page"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useSessionQuery,
  useSetParticipantPaidMutation,
} from "@/services/badminton/queries"

export default function EditSessionPage({ sessionId }: { sessionId: string }) {
  const sessionQuery = useSessionQuery(sessionId)
  const setPaid = useSetParticipantPaidMutation(sessionId)

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
        <div className="space-y-4">
          <ShareLink shareToken={session.shareToken} />
          <PaymentMethodPicker
            sessionId={sessionId}
            value={session.paymentMethodId}
          />
          <SessionEditor
            sessionId={sessionId}
            initialValues={sessionToValues(session)}
            paymentMethod={session.paymentMethod ?? null}
            paymentStatus={Object.fromEntries(
              (session.participants ?? []).map((p) => [p.id, { paid: p.paid }])
            )}
            onTogglePaid={(participantId, paid) =>
              setPaid.mutate({ participantId, paid })
            }
          />
        </div>
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
