import { useMemo } from "react"
import { addMonths, startOfYear } from "date-fns"

import { useCalendar } from "@/components/full-calendar/contexts/calendar-context"
import { ScrollArea } from "@/components/ui/scroll-area"

import { YearViewMonth } from "@/components/full-calendar/components/year-view/year-view-month"

import type { IEvent } from "@/components/full-calendar/interfaces"

interface IProps {
  allEvents: IEvent[]
}

export function CalendarYearView({ allEvents }: IProps) {
  const { selectedDate } = useCalendar()

  const months = useMemo(() => {
    const yearStart = startOfYear(selectedDate)
    return Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i))
  }, [selectedDate])

  return (
    // Same fixed-height + internal scroll as the day/agenda views — without
    // it, 12 month tiles stacked 1-2 per row (narrow/@container-squeezed
    // widths) push the whole page height way out instead of scrolling.
    // Capped at 800px but shrinks on shorter viewports so this view never
    // pushes the whole page taller than the screen (24rem ≈ chrome above it).
    <ScrollArea
      className="h-[min(800px,max(240px,calc(100dvh-24rem)))]"
      type="always"
    >
      <div className="p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {months.map((month) => (
            <YearViewMonth
              key={month.toString()}
              month={month}
              events={allEvents}
            />
          ))}
        </div>
      </div>
    </ScrollArea>
  )
}
