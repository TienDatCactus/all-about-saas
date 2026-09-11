import type { IEvent } from "./interfaces"
import type { TEventColor } from "./types"
import type { TeachingSession } from "@/services/teacher-room/types"

/** Status wins over priority (cancelled/completed are terminal). Among
 *  scheduled sessions, all three priorities get a distinct tone — low is
 *  quieter than normal, high stands out — so the calendar reads as a
 *  priority signal, not just "urgent vs not". */
function colorFor(session: TeachingSession): TEventColor {
  if (session.status === "cancelled") return "gray"
  if (session.status === "completed") return "green"
  if (session.priority === "high") return "red"
  if (session.priority === "low") return "purple"
  return "blue" // normal
}

export const STATUS_LABEL: Record<TeachingSession["status"], string> = {
  scheduled: "Chưa chốt",
  completed: "Đã dạy",
  cancelled: "Đã huỷ",
}
export const TYPE_LABEL: Record<TeachingSession["type"], string> = {
  regular: "Định kỳ",
  makeup: "Bù",
  extra: "Buổi thêm",
}
export const PRIORITY_LABEL: Record<TeachingSession["priority"], string> = {
  low: "Thấp",
  normal: "Bình thường",
  high: "Cao",
}

/** i18n keys for the labels above — use these (with `t()`) in rendered UI;
 *  the plain-string maps above stay Vietnamese-only for `sessionToEvent`'s
 *  `description` field, which is never displayed. */
export const STATUS_LABEL_KEY: Record<TeachingSession["status"], string> = {
  scheduled: "calendar.status.scheduled",
  completed: "calendar.status.completed",
  cancelled: "calendar.status.cancelled",
}
export const TYPE_LABEL_KEY: Record<TeachingSession["type"], string> = {
  regular: "calendar.type.regular",
  makeup: "calendar.type.makeup",
  extra: "calendar.type.extra",
}
export const PRIORITY_LABEL_KEY: Record<TeachingSession["priority"], string> = {
  low: "calendar.priority.low",
  normal: "calendar.priority.normal",
  high: "calendar.priority.high",
}

/**
 * Event card tone, keyed by the color `colorFor` assigns. Only blue/green/
 * red/purple/gray are ever produced (see `colorFor` above) — yellow/orange
 * exist purely so this Record type-checks against `IEvent.color`, and fall
 * back to the default "scheduled" tone (unreachable in practice).
 *
 * Uses this app's semantic tokens (primary/success/warning/muted), not the
 * calendar library's raw Tailwind hues — same soft-surface recipe as
 * `badgeVariants`' destructive variant (`bg-<token>/10 text-<token>`).
 */
const DEFAULT_TONE = {
  surface: "border-primary/20 bg-primary/10 text-primary dark:bg-primary/15",
  dot: "bg-primary",
}
export const EVENT_TONE: Record<TEventColor, { surface: string; dot: string }> =
  {
    blue: DEFAULT_TONE, // scheduled, normal priority
    green: {
      surface:
        "border-success/20 bg-success/10 text-success dark:bg-success/15",
      dot: "bg-success",
    }, // completed
    red: {
      surface:
        "border-warning/30 bg-warning/10 text-warning dark:bg-warning/15",
      dot: "bg-warning",
    }, // scheduled, unconfirmed + HIGH priority
    // No tint at all (vs. gray's solid muted fill) — a quieter, lower-emphasis
    // look for LOW priority that still reads as distinct from every other tone.
    purple: {
      surface: "border-border bg-transparent text-muted-foreground",
      dot: "bg-muted-foreground",
    }, // scheduled, LOW priority
    gray: {
      surface: "border-transparent bg-muted text-muted-foreground",
      dot: "bg-muted-foreground",
    }, // cancelled
    yellow: DEFAULT_TONE,
    orange: DEFAULT_TONE,
  }

export function sessionToEvent(session: TeachingSession): IEvent {
  return {
    id: session.id,
    startDate: `${session.scheduledDate}T${session.startTime}:00`,
    endDate: `${session.scheduledDate}T${session.endTime}:00`,
    title: session.student?.name ?? "Học sinh",
    color: colorFor(session),
    description: `${TYPE_LABEL[session.type]} · ${STATUS_LABEL[session.status]}${session.note ? ` · ${session.note}` : ""}`,
    user: {
      id: session.studentId,
      name: session.student?.name ?? "Học sinh",
      picturePath: null,
    },
    session,
  }
}
