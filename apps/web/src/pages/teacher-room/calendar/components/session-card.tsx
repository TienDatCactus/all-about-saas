import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useCancelSessionMutation,
  useCompleteSessionMutation,
  useReopenSessionMutation,
  useSetPriorityMutation,
} from "@/services/teacher-room/queries"
import type { TeachingSession } from "@/services/teacher-room/types"
import { useState } from "react"
import { RescheduleDialog } from "./reschedule-dialog"

const STATUS_LABEL: Record<TeachingSession["status"], string> = {
  scheduled: "Chưa chốt",
  completed: "Đã dạy",
  cancelled: "Đã huỷ",
}
const TYPE_LABEL: Record<TeachingSession["type"], string> = {
  regular: "Định kỳ",
  makeup: "Bù",
  extra: "Buổi thêm",
}
const PRIORITY_LABEL: Record<TeachingSession["priority"], string> = {
  low: "Ưu tiên thấp",
  normal: "Ưu tiên thường",
  high: "Ưu tiên cao",
}

export function SessionCard({ session }: { session: TeachingSession }) {
  const cancel = useCancelSessionMutation()
  const complete = useCompleteSessionMutation()
  const reopen = useReopenSessionMutation()
  const setPriority = useSetPriorityMutation()
  const [rescheduling, setRescheduling] = useState(false)

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">{session.student?.name}</span>
        <div className="flex gap-1">
          <Badge variant="secondary">{TYPE_LABEL[session.type]}</Badge>
          <Badge>{STATUS_LABEL[session.status]}</Badge>
        </div>
      </div>
      <span className="text-sm text-muted-foreground">
        {session.startTime}–{session.endTime}
      </span>
      {session.status === "scheduled" && (
        <>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => complete.mutate({ id: session.id })}
            >
              Hoàn thành
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRescheduling(true)}
            >
              Dời lịch
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => cancel.mutate({ id: session.id })}
            >
              Huỷ
            </Button>
          </div>
          {/* Manual escalation — a session sitting unconfirmed across days can be
              marked HIGH so it surfaces first in the pending banner and reminder email. */}
          <Select
            value={session.priority}
            onValueChange={(priority) =>
              setPriority.mutate({
                id: session.id,
                priority: priority as TeachingSession["priority"],
              })
            }
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.keys(PRIORITY_LABEL) as TeachingSession["priority"][]
              ).map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
      {session.status !== "scheduled" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => reopen.mutate({ id: session.id })}
        >
          Mở lại
        </Button>
      )}
      <RescheduleDialog
        session={session}
        open={rescheduling}
        onOpenChange={setRescheduling}
      />
    </div>
  )
}
