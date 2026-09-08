import { parseISO, differenceInMinutes } from "date-fns"

export interface SessionBlock {
  id: string
  startDate: string
  endDate: string
}

export function groupEvents<T extends SessionBlock>(dayEvents: T[]): T[][] {
  const sorted = [...dayEvents].sort(
    (a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
  )
  const groups: T[][] = []

  for (const event of sorted) {
    const eventStart = parseISO(event.startDate)
    let placed = false
    for (const group of groups) {
      // Non-null: a group is only ever created via `groups.push([event])`,
      // so it always has at least one element by construction.
      const lastEnd = parseISO(group[group.length - 1]!.endDate)
      if (eventStart >= lastEnd) {
        group.push(event)
        placed = true
        break
      }
    }
    if (!placed) groups.push([event])
  }

  return groups
}

export function getEventBlockStyle(
  event: SessionBlock,
  day: Date,
  groupIndex: number,
  groupSize: number,
  visibleHoursRange: { from: number; to: number }
) {
  const startDate = parseISO(event.startDate)
  const dayStart = new Date(day.setHours(0, 0, 0, 0))
  const eventStart = startDate < dayStart ? dayStart : startDate
  const startMinutes = differenceInMinutes(eventStart, dayStart)

  const visibleStartMinutes = visibleHoursRange.from * 60
  const visibleEndMinutes = visibleHoursRange.to * 60
  const top =
    ((startMinutes - visibleStartMinutes) /
      (visibleEndMinutes - visibleStartMinutes)) *
    100

  const width = 100 / groupSize
  const left = groupIndex * width

  return { top: `${top}%`, width: `${width}%`, left: `${left}%` }
}

const DEFAULT_VISIBLE_HOURS = { from: 7, to: 21 }

/** Widens the default 07:00–21:00 window to fit any session that falls outside it. */
export function getVisibleHours(sessions: SessionBlock[]) {
  let earliestEventHour = DEFAULT_VISIBLE_HOURS.from
  let latestEventHour = DEFAULT_VISIBLE_HOURS.to

  sessions.forEach((session) => {
    const startHour = parseISO(session.startDate).getHours()
    const end = parseISO(session.endDate)
    const endHour = end.getHours() + (end.getMinutes() > 0 ? 1 : 0)
    if (startHour < earliestEventHour) earliestEventHour = startHour
    if (endHour > latestEventHour) latestEventHour = endHour
  })

  latestEventHour = Math.min(latestEventHour, 24)
  const hours = Array.from(
    { length: latestEventHour - earliestEventHour },
    (_, i) => i + earliestEventHour
  )

  return { hours, earliestEventHour, latestEventHour }
}
