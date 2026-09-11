import { endOfDay, format, parseISO, startOfDay } from "date-fns"

import { useCalendar } from "@/components/full-calendar/contexts/calendar-context"
import { useDateFnsLocale, useTimeFormat } from "@/hooks/use-date-fns-locale"

import { DraggableEvent } from "@/components/full-calendar/components/dnd/draggable-event"
import { EventDetailsDialog } from "@/components/full-calendar/components/dialogs/event-details-dialog"
import DataItem from "@/components/custom/data/item"

import { cn } from "@/lib/utils"
import { EVENT_TONE } from "@/components/full-calendar/adapter"

import type { IEvent } from "@/components/full-calendar/interfaces"

interface IProps {
  event: IEvent
  /** The day cell this badge is rendered in — every session is single-day,
   *  so this only ever needs to gate visibility, never a multi-day split. */
  cellDate: Date
  className?: string
}

export function MonthEventBadge({ event, cellDate, className }: IProps) {
  const { badgeVariant } = useCalendar()
  const locale = useDateFnsLocale()
  const timeFormat = useTimeFormat()

  const start = parseISO(event.startDate)
  const itemStart = startOfDay(start)
  const itemEnd = endOfDay(parseISO(event.endDate))

  if (cellDate < itemStart || cellDate > itemEnd) return null

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
          action={
            <span className="text-xs">
              {format(start, timeFormat.time, { locale })}
            </span>
          }
          className={cn(
            "h-6.5 cursor-pointer py-0 select-none",
            tone.surface,
            className
          )}
        />
      </EventDetailsDialog>
    </DraggableEvent>
  )
}
