import { format, parseISO, differenceInMinutes } from "date-fns"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { SessionDetailDialog } from "./session-detail-dialog"
import type { TeachingSession } from "@/services/teacher-room/types"

const chipVariants = cva(
  "flex flex-col gap-0.5 truncate rounded-md border px-2 py-1.5 text-xs whitespace-nowrap select-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
  {
    variants: {
      tone: {
        scheduled:
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
        scheduledHigh:
          "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300",
        completed:
          "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
        cancelled:
          "border-neutral-200 bg-neutral-50 text-neutral-500 line-through dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-500",
      },
    },
    defaultVariants: { tone: "scheduled" },
  }
)

function toneFor(
  session: TeachingSession
): "scheduled" | "scheduledHigh" | "completed" | "cancelled" {
  if (session.status === "cancelled") return "cancelled"
  if (session.status === "completed") return "completed"
  return session.priority === "high" ? "scheduledHigh" : "scheduled"
}

/** Renders only the compact chip; absolute top/left/width positioning is
 *  applied by the wrapping div in CalendarWeekGrid, same split as the
 *  original EventBlock/CalendarWeekView. */
export function SessionChip({ session }: { session: TeachingSession }) {
  const start = parseISO(`${session.scheduledDate}T${session.startTime}:00`)
  const end = parseISO(`${session.scheduledDate}T${session.endTime}:00`)
  const durationInMinutes = differenceInMinutes(end, start)
  const heightInPixels = (durationInMinutes / 60) * 96 - 8

  // DialogTrigger only wires up onClick, so Enter/Space on the focused chip
  // has to forward to it — same handler as the original EventBlock.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      if (e.currentTarget instanceof HTMLElement) e.currentTarget.click()
    }
  }

  return (
    <SessionDetailDialog session={session}>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={cn(
          chipVariants({ tone: toneFor(session) }),
          durationInMinutes < 35 && "justify-center py-0"
        )}
        style={{ height: `${heightInPixels}px` }}
      >
        <p className="truncate font-semibold">{session.student?.name}</p>
        {durationInMinutes > 25 && (
          <p>
            {format(start, "HH:mm")} – {format(end, "HH:mm")}
          </p>
        )}
      </div>
    </SessionDetailDialog>
  )
}
