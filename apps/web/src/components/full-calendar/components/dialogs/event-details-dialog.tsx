import { cloneElement, isValidElement, useState } from "react"
import { format, parseISO } from "date-fns"
import { useTranslation } from "react-i18next"

import { useDateFnsLocale } from "@/hooks/use-date-fns-locale"

import { useDisclosure } from "@/hooks/use-disclosure"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import DataDialog from "@/components/custom/data/dialog"
import {
  useCancelSessionMutation,
  useCompleteSessionMutation,
  useReopenSessionMutation,
  useSetPriorityMutation,
} from "@/services/teacher-room/queries"
import {
  PRIORITY_LABEL_KEY,
  STATUS_LABEL_KEY,
  TYPE_LABEL_KEY,
} from "@/components/full-calendar/adapter"

import { RescheduleDialog } from "./reschedule-dialog"

import type { IEvent } from "@/components/full-calendar/interfaces"
import type { TeachingSession } from "@/services/teacher-room/types"

interface IProps {
  event: IEvent
  children: React.ReactNode
}

export function EventDetailsDialog({ event, children }: IProps) {
  const { t } = useTranslation()
  const { session } = event
  const locale = useDateFnsLocale()
  const { isOpen, onOpen, onToggle } = useDisclosure()
  const cancel = useCancelSessionMutation()
  const complete = useCompleteSessionMutation()
  const reopen = useReopenSessionMutation()
  const setPriority = useSetPriorityMutation()
  const [rescheduling, setRescheduling] = useState(false)

  const start = parseISO(event.startDate)

  return (
    <>
      {isValidElement(children)
        ? cloneElement(children as React.ReactElement<any>, { onClick: onOpen })
        : children}

      <DataDialog
        open={isOpen}
        onOpenChange={onToggle}
        title={event.title}
        content={
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {format(start, "d MMM yyyy", { locale })} · {session.startTime}–
                {session.endTime}
              </span>
              <div className="flex gap-1">
                <Badge variant="secondary">
                  {t(TYPE_LABEL_KEY[session.type])}
                </Badge>
                <Badge>{t(STATUS_LABEL_KEY[session.status])}</Badge>
              </div>
            </div>

            {session.note && (
              <p className="text-sm text-muted-foreground">{session.note}</p>
            )}

            {session.status === "scheduled" && (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => complete.mutate({ id: session.id })}
                  >
                    {t("calendar.dialogs.eventDetails.complete")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRescheduling(true)}
                  >
                    {t("calendar.dialogs.eventDetails.reschedule")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => cancel.mutate({ id: session.id })}
                  >
                    {t("calendar.dialogs.eventDetails.cancel")}
                  </Button>
                </div>

                {/* Manual escalation — a session sitting unconfirmed across
                    days can be marked HIGH so it surfaces first in the
                    pending banner and reminder email. */}
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
                      Object.keys(
                        PRIORITY_LABEL_KEY
                      ) as TeachingSession["priority"][]
                    ).map((p) => (
                      <SelectItem key={p} value={p}>
                        {t(PRIORITY_LABEL_KEY[p])}
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
                {t("calendar.dialogs.eventDetails.reopen")}
              </Button>
            )}
          </div>
        }
      />

      <RescheduleDialog
        session={session}
        open={rescheduling}
        onOpenChange={setRescheduling}
      />
    </>
  )
}
