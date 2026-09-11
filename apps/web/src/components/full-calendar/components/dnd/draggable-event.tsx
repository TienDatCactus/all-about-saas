"use client"

import { useDrag } from "react-dnd"
import { useRef, useEffect } from "react"
import { getEmptyImage } from "react-dnd-html5-backend"

import { cn } from "@/lib/utils"

import type { IEvent } from "@/components/full-calendar/interfaces"

export const ItemTypes = {
  EVENT: "event",
}

interface DraggableEventProps {
  event: IEvent
  children: React.ReactNode
}

export function DraggableEvent({ event, children }: DraggableEventProps) {
  const ref = useRef<HTMLDivElement>(null)

  const [{ isDragging }, drag, preview] = useDrag(
    () => ({
      type: ItemTypes.EVENT,
      item: () => {
        const width = ref.current?.offsetWidth || 0
        const height = ref.current?.offsetHeight || 0
        return { event, children, width, height }
      },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    // Without deps, react-dnd's useOptionalFactory memoizes this spec once
    // on mount and never again — `item()` would keep closing over the
    // FIRST render's `children` (and its color) forever, even after the
    // event's status/priority (and so its tone) later changes.
    [event, children]
  )

  // Hide the default drag preview
  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true })
  }, [preview])

  drag(ref)

  return (
    <div ref={ref} className={cn(isDragging && "opacity-40")}>
      {children}
    </div>
  )
}
