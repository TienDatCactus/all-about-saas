import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useCalendar } from "@/components/full-calendar/contexts/calendar-context"

import { DayCell } from "@/components/full-calendar/components/month-view/day-cell"

import {
  getCalendarCells,
  calculateMonthEventPositions,
} from "@/components/full-calendar/helpers"

import type { IEvent } from "@/components/full-calendar/interfaces"

interface IProps {
  singleDayEvents: IEvent[]
  multiDayEvents: IEvent[]
}

const WEEK_DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const

export function CalendarMonthView({ singleDayEvents, multiDayEvents }: IProps) {
  const { t } = useTranslation()
  const { selectedDate } = useCalendar()

  const allEvents = [...multiDayEvents, ...singleDayEvents]

  const cells = useMemo(() => getCalendarCells(selectedDate), [selectedDate])

  const eventPositions = useMemo(
    () =>
      calculateMonthEventPositions(
        multiDayEvents,
        singleDayEvents,
        selectedDate
      ),
    [multiDayEvents, singleDayEvents, selectedDate]
  )

  return (
    <div>
      <div className="grid grid-cols-7 divide-x">
        {WEEK_DAY_KEYS.map((day) => (
          <div key={day} className="flex items-center justify-center py-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t(`calendar.month.weekday.${day}`)}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 overflow-hidden">
        {cells.map((cell) => (
          <DayCell
            key={cell.date.toISOString()}
            cell={cell}
            events={allEvents}
            eventPositions={eventPositions}
          />
        ))}
      </div>
    </div>
  )
}
