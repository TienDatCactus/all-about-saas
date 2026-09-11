import { useMemo } from "react"
import { formatDate } from "date-fns"
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { TCalendarView } from "../../types"
import type { IEvent } from "../../interfaces"
import { useCalendar } from "../../contexts/calendar-context"
import { getEventsCount, navigateDate, rangeText } from "../../helpers"
import { useDateFnsLocale } from "@/hooks/use-date-fns-locale"

interface IProps {
  view: TCalendarView
  events: IEvent[]
}

export function DateNavigator({ view, events }: IProps) {
  const { selectedDate, setSelectedDate } = useCalendar()
  const locale = useDateFnsLocale()

  const month = formatDate(selectedDate, "MMMM", { locale })
  const year = selectedDate.getFullYear()

  const eventCount = useMemo(
    () => getEventsCount(events, selectedDate, view),
    [events, selectedDate, view]
  )

  const handlePrevious = () =>
    setSelectedDate(navigateDate(selectedDate, view, "previous"))
  const handleNext = () =>
    setSelectedDate(navigateDate(selectedDate, view, "next"))

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold">
          {month} {year}
        </span>
        <Badge variant="outline" className="px-1.5">
          {eventCount} events
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="size-6.5 px-0 [&_svg]:size-4.5"
          onClick={handlePrevious}
        >
          <CaretLeftIcon />
        </Button>

        <p className="text-sm text-muted-foreground">
          {rangeText(view, selectedDate, locale)}
        </p>

        <Button
          variant="outline"
          className="size-6.5 px-0 [&_svg]:size-4.5"
          onClick={handleNext}
        >
          <CaretRightIcon />
        </Button>
      </div>
    </div>
  )
}
