import { format } from "date-fns"
import { useEffect, useState } from "react"

interface IProps {
  firstVisibleHour: number
  lastVisibleHour: number
}

export function CalendarTimeline({
  firstVisibleHour,
  lastVisibleHour,
}: IProps) {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60 * 1000)
    return () => clearInterval(timer)
  }, [])

  const getCurrentTimePosition = () => {
    const minutes = currentTime.getHours() * 60 + currentTime.getMinutes()
    const visibleStartMinutes = firstVisibleHour * 60
    const visibleEndMinutes = lastVisibleHour * 60
    return (
      ((minutes - visibleStartMinutes) /
        (visibleEndMinutes - visibleStartMinutes)) *
      100
    )
  }

  const currentHour = currentTime.getHours()
  if (currentHour < firstVisibleHour || currentHour >= lastVisibleHour)
    return null

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-50 border-t border-primary"
      style={{ top: `${getCurrentTimePosition()}%` }}
    >
      <div className="absolute top-0 left-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
      <div className="absolute -left-14 flex w-12 -translate-y-1/2 justify-end bg-background pr-1 text-xs font-medium text-primary">
        {format(currentTime, "HH:mm")}
      </div>
    </div>
  )
}
