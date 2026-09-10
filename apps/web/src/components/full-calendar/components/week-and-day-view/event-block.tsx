import { format, differenceInMinutes, parseISO } from "date-fns"

import { useCalendar } from "@/components/full-calendar/contexts/calendar-context"
import { useDateFnsLocale } from "@/components/full-calendar/hooks/use-date-fns-locale"

import { DraggableEvent } from "@/components/full-calendar/components/dnd/draggable-event"
import { EventDetailsDialog } from "@/components/full-calendar/components/dialogs/event-details-dialog"
import DataItem from "@/components/custom/data/item"

import { cn } from "@/lib/utils"
import { EVENT_TONE } from "@/components/full-calendar/adapter"

import type { HTMLAttributes } from "react"
import type { IEvent } from "@/components/full-calendar/interfaces"

interface IProps extends Pick<HTMLAttributes<HTMLDivElement>, "className"> {
  event: IEvent
}

export function EventBlock({ event, className }: IProps) {
  const { badgeVariant } = useCalendar()
  const locale = useDateFnsLocale()

  const start = parseISO(event.startDate)
  const end = parseISO(event.endDate)
  const durationInMinutes = differenceInMinutes(end, start)
  const heightInPixels = (durationInMinutes / 60) * 96 - 8

  const tone = EVENT_TONE[event.color]
  const showDot = ["mixed", "dot"].includes(badgeVariant)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      if (e.currentTarget instanceof HTMLElement) e.currentTarget.click()
    }
  }

  return (
    <DraggableEvent event={event}>
      <EventDetailsDialog event={event}>
        <DataItem
          role="button"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          style={{ height: `${heightInPixels}px` }}
          size="xs"
          media={
            showDot
              ? {
                  variant: "icon",
                  icon: (
                    <span className={cn("size-2 rounded-full", tone.dot)} />
                  ),
                }
              : undefined
          }
          title={event.title}
          description={
            durationInMinutes > 25
              ? `${format(start, "h:mm a", { locale })} - ${format(end, "h:mm a", { locale })}`
              : undefined
          }
          className={cn(
            "cursor-pointer select-none",
            tone.surface,
            durationInMinutes < 35 && "py-0",
            className
          )}
        />
      </EventDetailsDialog>
    </DraggableEvent>
  )
}
