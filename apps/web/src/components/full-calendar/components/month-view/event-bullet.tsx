import { cn } from "@/lib/utils"

import { EVENT_TONE } from "@/components/full-calendar/adapter"
import type { TEventColor } from "@/components/full-calendar/types"

export function EventBullet({
  color,
  className,
}: {
  color: TEventColor
  className: string
}) {
  return (
    <div
      className={cn("size-2 rounded-full", EVENT_TONE[color].dot, className)}
    />
  )
}
