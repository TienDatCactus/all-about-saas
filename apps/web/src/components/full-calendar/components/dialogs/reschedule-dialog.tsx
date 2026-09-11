import { useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import { useTranslation } from "react-i18next"

import DataDialog from "@/components/custom/data/dialog"
import { Button as StatefulButton } from "@/components/custom/stateful-button"
import { SingleDayPicker } from "@/components/ui/single-day-picker"
import { useRescheduleSessionMutation } from "@/services/teacher-room/queries"
import type { TeachingSession } from "@/services/teacher-room/types"

export function RescheduleDialog({
  session,
  open,
  onOpenChange,
}: {
  session: TeachingSession
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const reschedule = useRescheduleSessionMutation()
  const [newDate, setNewDate] = useState<Date | undefined>(
    parseISO(session.scheduledDate)
  )

  // Reopening the dialog on a different (or the same, later-changed) session
  // must not show a stale pick from the last time it was open.
  useEffect(() => {
    if (open) setNewDate(parseISO(session.scheduledDate))
  }, [open, session.scheduledDate])

  return (
    <DataDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("calendar.dialogs.reschedule.title")}
      content={
        <div className="flex flex-col gap-4">
          <SingleDayPicker
            value={newDate}
            onSelect={setNewDate}
            placeholder={t("calendar.dialogs.reschedule.datePlaceholder")}
          />
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
            {t("calendar.dialogs.reschedule.confirm")}
          </StatefulButton>
        </div>
      }
    />
  )
}
