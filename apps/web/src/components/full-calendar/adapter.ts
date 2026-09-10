import type { IEvent } from "./interfaces"
import type { TEventColor } from "./types"
import type { TeachingSession } from "@/services/teacher-room/types"

/** Same tone logic as the deleted SessionChip — cancelled/completed win over
 *  priority, an unconfirmed HIGH-priority session stands out in red. */
function colorFor(session: TeachingSession): TEventColor {
  if (session.status === "cancelled") return "gray"
  if (session.status === "completed") return "green"
  return session.priority === "high" ? "red" : "blue"
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
