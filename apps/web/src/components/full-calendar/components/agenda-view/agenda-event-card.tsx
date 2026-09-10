import { format, parseISO } from "date-fns"

import { useCalendar } from "../../contexts/calendar-context"
import { EventDetailsDialog } from "../dialogs/event-details-dialog"
import DataCard from "@/components/custom/data/card"
import { cn } from "@/lib/utils"
import { ClockIcon, TextAaIcon, UserIcon } from "@phosphor-icons/react"

import type { IEvent } from "../../interfaces"
import { EVENT_TONE } from "../../adapter"

interface IProps {
  event: IEvent
  eventCurrentDay?: number
  eventTotalDays?: number
}

export function AgendaEventCard({
  event,
  eventCurrentDay,
  eventTotalDays,
}: IProps) {
  const { badgeVariant } = useCalendar()

  const startDate = parseISO(event.startDate)
  const endDate = parseISO(event.endDate)

  const tone = EVENT_TONE[event.color]
  const showDot = ["mixed", "dot"].includes(badgeVariant)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      if (e.currentTarget instanceof HTMLElement) e.currentTarget.click()
    }
  }

  return (
    <EventDetailsDialog event={event}>
      <DataCard
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={cn("cursor-pointer gap-3 py-3 select-none", tone.surface)}
        title={
          <span className="flex items-center gap-1.5">
            {showDot && (
              <span className={cn("size-2 shrink-0 rounded-full", tone.dot)} />
            )}
            {eventCurrentDay && eventTotalDays && (
              <span className="text-xs font-normal">
                Day {eventCurrentDay} of {eventTotalDays} •{" "}
              </span>
            )}
            {event.title}
          </span>
        }
        content={
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1">
              <UserIcon className="size-3 shrink-0" />
              <p className="text-xs text-foreground">{event.user.name}</p>
            </div>

            <div className="flex items-center gap-1">
              <ClockIcon className="size-3 shrink-0" />
              <p className="text-xs text-foreground">
                {format(startDate, "h:mm a")} - {format(endDate, "h:mm a")}
              </p>
            </div>

            <div className="flex items-center gap-1">
              <TextAaIcon className="size-3 shrink-0" />
              <p className="text-xs text-foreground">{event.description}</p>
            </div>
          </div>
        }
      />
    </EventDetailsDialog>
  )
}
