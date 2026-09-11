import { isToday } from "date-fns"

import { useCalendar } from "@/components/full-calendar/contexts/calendar-context"
import { useSearchParamsSetter } from "@/hooks/use-search-params-setter"

import { cn } from "@/lib/utils"

import type { IEvent } from "@/components/full-calendar/interfaces"

interface IProps {
  day: number
  date: Date
  events: IEvent[]
}

export function YearViewDayCell({ day, date, events }: IProps) {
  const setSearchParams = useSearchParamsSetter()
  const { setSelectedDate } = useCalendar()

  const maxIndicators = 3
  const eventCount = events.length

  const handleClick = () => {
    setSelectedDate(date)
    setSearchParams({ view: "day" })
  }

  return (
    <button
      onClick={handleClick}
      type="button"
      className="flex h-11 flex-1 flex-col items-center justify-start gap-0.5 rounded-md pt-1 hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div
        className={cn(
          "flex size-6 items-center justify-center rounded-full text-xs font-medium",
          isToday(date) && "bg-primary font-semibold text-primary-foreground"
        )}
      >
        {day}
      </div>

      {eventCount > 0 && (
        <div className="mt-0.5 flex gap-0.5">
          {eventCount <= maxIndicators
            ? events.map((event) => (
                <div
                  key={event.id}
                  className={cn(
                    "size-1.5 rounded-full",
                    event.color === "blue" && "bg-blue-600",
                    event.color === "green" && "bg-green-600",
                    event.color === "red" && "bg-red-600",
                    event.color === "yellow" && "bg-yellow-600",
                    event.color === "purple" && "bg-purple-600",
                    event.color === "orange" && "bg-orange-600",
                    event.color === "gray" && "bg-neutral-600"
                  )}
                />
              ))
            : (() => {
                // `eventCount > maxIndicators` (> 0) guarantees this branch only
                // runs when `events` is non-empty.
                const firstEvent = events[0]!
                return (
                  <>
                    <div
                      className={cn(
                        "size-1.5 rounded-full",
                        firstEvent.color === "blue" && "bg-blue-600",
                        firstEvent.color === "green" && "bg-green-600",
                        firstEvent.color === "red" && "bg-red-600",
                        firstEvent.color === "yellow" && "bg-yellow-600",
                        firstEvent.color === "purple" && "bg-purple-600",
                        firstEvent.color === "orange" && "bg-orange-600"
                      )}
                    />
                    <span className="text-[7px] text-muted-foreground">
                      +{eventCount - 1}
                    </span>
                  </>
                )
              })()}
        </div>
      )}
    </button>
  )
}
