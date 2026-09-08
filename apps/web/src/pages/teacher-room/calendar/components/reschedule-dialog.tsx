import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button as StatefulButton } from "@/components/custom/stateful-button"
import DatePicker from "@/components/date-picker"
import { useRescheduleSessionMutation } from "@/services/teacher-room/queries"
import type { TeachingSession } from "@/services/teacher-room/types"
import { format, parseISO } from "date-fns"
import { useState } from "react"

export function RescheduleDialog({
  session,
  open,
  onOpenChange,
}: {
  session: TeachingSession
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const reschedule = useRescheduleSessionMutation()
  const [newDate, setNewDate] = useState<Date | undefined>(
    parseISO(session.scheduledDate)
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dời lịch</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <DatePicker value={newDate} onChange={setNewDate} />
          <StatefulButton
            mutationState={reschedule.status}
            disabled={!newDate}
            onClick={async () => {
              if (!newDate) return
              await reschedule.mutateAsync({
                id: session.id,
                data: { newDate: format(newDate, "yyyy-MM-dd") },
              })
              onOpenChange(false)
            }}
          >
            Xác nhận
          </StatefulButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
