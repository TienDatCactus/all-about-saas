import { cloneElement, isValidElement, useState } from "react"
import { format, parseISO } from "date-fns"

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
  PRIORITY_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
} from "@/components/full-calendar/adapter"

import { RescheduleDialog } from "./reschedule-dialog"

import type { IEvent } from "@/components/full-calendar/interfaces"
import type { TeachingSession } from "@/services/teacher-room/types"

interface IProps {
  event: IEvent
  children: React.ReactNode
}

export function EventDetailsDialog({ event, children }: IProps) {
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
                <Badge variant="secondary">{TYPE_LABEL[session.type]}</Badge>
                <Badge>{STATUS_LABEL[session.status]}</Badge>
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
                        PRIORITY_LABEL
                      ) as TeachingSession["priority"][]
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
