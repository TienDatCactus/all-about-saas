import { format, parseISO, areIntervalsOverlapping } from "date-fns"
import { PlusIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SessionChip } from "./session-chip"
import { CalendarTimeline } from "./calendar-time-line"
import {
  groupEvents,
  getEventBlockStyle,
  getVisibleHours,
} from "../lib/helpers"
import type { SessionBlock } from "../lib/helpers"
import type { TeachingSession } from "@/services/teacher-room/types"

function toBlock(session: TeachingSession): SessionBlock {
  return {
    id: session.id,
    startDate: `${session.scheduledDate}T${session.startTime}:00`,
    endDate: `${session.scheduledDate}T${session.endTime}:00`,
  }
}

export function CalendarWeekGrid({
  days,
  sessions,
  onAddSession,
}: {
  days: Date[]
  sessions: TeachingSession[]
  onAddSession: (dayStr: string) => void
}) {
  const { hours, earliestEventHour, latestEventHour } = getVisibleHours(
    sessions.map(toBlock)
  )

  return (
    <div className="flex flex-col">
      <div className="relative z-20 flex border-b">
        <div className="w-14" />
        <div className="grid flex-1 grid-cols-7 divide-x border-l">
          {days.map((day, index) => (
            <div
              key={index}
              className="flex items-center justify-center gap-1 py-2"
            >
              <span className="text-xs font-medium text-muted-foreground">
                {format(day, "EEE")}{" "}
                <span className="ml-1 font-semibold text-foreground">
                  {format(day, "d")}
                </span>
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="size-5"
                onClick={() => onAddSession(format(day, "yyyy-MM-dd"))}
              >
                <PlusIcon />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <ScrollArea className="h-[640px]" type="always">
        <div className="flex overflow-hidden">
          <div className="relative w-14">
            {hours.map((hour, index) => (
              <div key={hour} className="relative" style={{ height: "96px" }}>
                {index !== 0 && (
                  <span className="absolute -top-3 right-2 text-xs text-muted-foreground">
                    {hour}:00
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="relative flex-1 border-l">
            <div className="grid grid-cols-7 divide-x">
              {days.map((day, dayIndex) => {
                const dayStr = format(day, "yyyy-MM-dd")
                const daySessions = sessions.filter(
                  (s) => s.scheduledDate === dayStr
                )
                const dayBlocks = daySessions.map(toBlock)
                const groupedBlocks = groupEvents(dayBlocks)

                return (
                  <div key={dayIndex} className="relative">
                    {hours.map((hour, index) => (
                      <div
                        key={hour}
                        className={index !== 0 ? "border-b" : undefined}
                        style={{ height: "96px" }}
                      />
                    ))}

                    {groupedBlocks.map((group, groupIndex) =>
                      group.map((block) => {
                        const session = daySessions.find(
                          (s) => s.id === block.id
                        )
                        if (!session) return null

                        let style = getEventBlockStyle(
                          block,
                          new Date(day),
                          groupIndex,
                          groupedBlocks.length,
                          { from: earliestEventHour, to: latestEventHour }
                        )
                        const hasOverlap = groupedBlocks.some(
                          (otherGroup, otherIndex) =>
                            otherIndex !== groupIndex &&
                            otherGroup.some((otherBlock) =>
                              areIntervalsOverlapping(
                                {
                                  start: parseISO(block.startDate),
                                  end: parseISO(block.endDate),
                                },
                                {
                                  start: parseISO(otherBlock.startDate),
                                  end: parseISO(otherBlock.endDate),
                                }
                              )
                            )
                        )
                        if (!hasOverlap)
                          style = { ...style, width: "100%", left: "0%" }

                        return (
                          <div
                            key={block.id}
                            className="absolute p-1"
                            style={style}
                          >
                            <SessionChip session={session} />
                          </div>
                        )
                      })
                    )}
                  </div>
                )
              })}
            </div>

            <CalendarTimeline
              firstVisibleHour={earliestEventHour}
              lastVisibleHour={latestEventHour}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
