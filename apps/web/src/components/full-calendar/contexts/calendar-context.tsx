import { createContext, useContext, useState } from "react"

import type { Dispatch, SetStateAction } from "react"
import type { IEvent } from "../interfaces"
import type { TBadgeVariant, TVisibleHours, TWorkingHours } from "../types"

interface ICalendarContext {
  selectedDate: Date
  setSelectedDate: (date: Date | undefined) => void
  badgeVariant: TBadgeVariant
  setBadgeVariant: (variant: TBadgeVariant) => void
  workingHours: TWorkingHours
  setWorkingHours: Dispatch<SetStateAction<TWorkingHours>>
  visibleHours: TVisibleHours
  setVisibleHours: Dispatch<SetStateAction<TVisibleHours>>
  events: IEvent[]
}

const CalendarContext = createContext({} as ICalendarContext)

const WORKING_HOURS = {
  0: { from: 0, to: 0 },
  1: { from: 8, to: 17 },
  2: { from: 8, to: 17 },
  3: { from: 8, to: 17 },
  4: { from: 8, to: 17 },
  5: { from: 8, to: 17 },
  6: { from: 8, to: 12 },
}

const VISIBLE_HOURS = { from: 7, to: 18 }

export function CalendarProvider({
  children,
  events,
  selectedDate,
  onSelectedDateChange,
}: {
  children: React.ReactNode
  events: IEvent[]
  /** Lifted to the page: the page needs it too, to compute the fetch range
   *  for whichever view is active. */
  selectedDate: Date
  onSelectedDateChange: (date: Date) => void
}) {
  const [badgeVariant, setBadgeVariant] = useState<TBadgeVariant>("colored")
  const [visibleHours, setVisibleHours] = useState<TVisibleHours>(VISIBLE_HOURS)
  const [workingHours, setWorkingHours] = useState<TWorkingHours>(WORKING_HOURS)

  const handleSelectDate = (date: Date | undefined) => {
    if (!date) return
    onSelectedDateChange(date)
  }

  return (
    <CalendarContext.Provider
      value={{
        selectedDate,
        setSelectedDate: handleSelectDate,
        badgeVariant,
        setBadgeVariant,
        visibleHours,
        setVisibleHours,
        workingHours,
        setWorkingHours,
        // Real data: the page refetches via TanStack Query and hands down a
        // fresh array on every render — no local copy to keep in sync.
        events,
      }}
    >
      {children}
    </CalendarContext.Provider>
  )
}

export function useCalendar(): ICalendarContext {
  const context = useContext(CalendarContext)
  if (!context)
    throw new Error("useCalendar must be used within a CalendarProvider.")
  return context
}
