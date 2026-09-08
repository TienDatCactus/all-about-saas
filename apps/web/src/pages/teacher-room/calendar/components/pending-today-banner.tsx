import { WarningIcon } from "@phosphor-icons/react"
import {
  usePendingTodayQuery,
  useCompleteSessionMutation,
} from "@/services/teacher-room/queries"

// API already returns pending sessions HIGH-priority first (server-side order:
// priority DESC, startTime ASC) — this component does not re-sort.
export function PendingTodayBanner() {
  const pendingQuery = usePendingTodayQuery()
  const complete = useCompleteSessionMutation()
  const pending = pendingQuery.data ?? []

  if (pending.length === 0) return null

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950">
      <div className="flex items-center gap-2 font-medium">
        <WarningIcon /> {pending.length} buổi hôm nay chưa chốt
      </div>
      <ul className="flex flex-col gap-1">
        {pending.map((session) => (
          <li
            key={session.id}
            className="flex items-center justify-between text-sm"
          >
            <span>
              {session.priority === "high" && (
                <span className="text-destructive">● </span>
              )}
              {session.student?.name} · {session.startTime}–{session.endTime}
            </span>
            <button
              className="text-primary underline"
              onClick={() => complete.mutate({ id: session.id })}
            >
              Hoàn thành
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
