import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { CalendarIcon, ClockIcon, UserIcon } from "@phosphor-icons/react"
import { parseISO, areIntervalsOverlapping, format } from "date-fns"

import { useCalendar } from "@/components/full-calendar/contexts/calendar-context"
import { useDateFnsLocale, useTimeFormat } from "@/hooks/use-date-fns-locale"

import { Calendar } from "@/components/ui/calendar"
import { ScrollArea } from "@/components/ui/scroll-area"

import { AddEventDialog } from "@/components/full-calendar/components/dialogs/add-event-dialog"
import { EventBlock } from "@/components/full-calendar/components/week-and-day-view/event-block"
import { DroppableTimeBlock } from "@/components/full-calendar/components/dnd/droppable-time-block"
import { CalendarTimeline } from "@/components/full-calendar/components/week-and-day-view/calendar-time-line"

import { cn } from "@/lib/utils"
import {
  groupEvents,
  getEventBlockStyle,
  isWorkingHour,
  getCurrentEvents,
  getVisibleHours,
} from "@/components/full-calendar/helpers"

import type { IEvent } from "@/components/full-calendar/interfaces"

interface IProps {
  singleDayEvents: IEvent[]
}

export function CalendarDayView({ singleDayEvents }: IProps) {
  const { selectedDate, setSelectedDate, visibleHours, workingHours } =
    useCalendar()
  const [, setCurrentTime] = useState(new Date())
  const locale = useDateFnsLocale()
  const timeFormat = useTimeFormat()
  const { t } = useTranslation()

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60 * 1000)
    return () => clearInterval(timer)
  }, [])

  const { hours, earliestEventHour, latestEventHour } = getVisibleHours(
    visibleHours,
    singleDayEvents
  )

  const currentEvents = getCurrentEvents(singleDayEvents)

  const dayEvents = singleDayEvents.filter((event) => {
    const eventDate = parseISO(event.startDate)
    return (
      eventDate.getDate() === selectedDate.getDate() &&
      eventDate.getMonth() === selectedDate.getMonth() &&
      eventDate.getFullYear() === selectedDate.getFullYear()
    )
  })

  const groupedEvents = groupEvents(dayEvents)

  return (
    <div className="flex">
      <div className="flex flex-1 flex-col">
        <div>
          {/* Day header */}
          <div className="relative z-20 flex border-b">
            <div className="w-18"></div>
            <span className="flex-1 border-l py-2 text-center text-xs font-medium text-muted-foreground">
              {format(selectedDate, "EE", { locale })}{" "}
              <span className="font-semibold text-foreground">
                {format(selectedDate, "d")}
              </span>
            </span>
          </div>
        </div>

        {/* Capped at 800px but shrinks on shorter viewports so this view
            never pushes the whole page taller than the screen (24rem ≈
            chrome above it: header, page title, calendar toolbar). */}
        <ScrollArea
          className="h-[min(800px,max(240px,calc(100dvh-24rem)))]"
          type="always"
        >
          <div className="flex">
            {/* Hours column */}
            <div className="relative w-18">
              {hours.map((hour, index) => (
                <div key={hour} className="relative" style={{ height: "96px" }}>
                  <div className="absolute -top-3 right-2 flex h-6 items-center">
                    {index !== 0 && (
                      <span className="text-xs text-muted-foreground">
                        {format(
                          new Date().setHours(hour, 0, 0, 0),
                          timeFormat.hour,
                          { locale }
                        )}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="relative flex-1 border-l">
              <div className="relative">
                {hours.map((hour, index) => {
                  const isDisabled = !isWorkingHour(
                    selectedDate,
                    hour,
                    workingHours
                  )

                  return (
                    <div
                      key={hour}
                      className={cn(
                        "relative",
                        isDisabled && "bg-calendar-disabled-hour"
                      )}
                      style={{ height: "96px" }}
                    >
                      {index !== 0 && (
                        <div className="pointer-events-none absolute inset-x-0 top-0 border-b"></div>
                      )}

                      <DroppableTimeBlock
                        date={selectedDate}
                        hour={hour}
                        minute={0}
                      >
                        <AddEventDialog
                          startDate={selectedDate}
                          startTime={{ hour, minute: 0 }}
                        >
                          <div className="absolute inset-x-0 top-0 h-[24px] cursor-pointer transition-colors hover:bg-accent" />
                        </AddEventDialog>
                      </DroppableTimeBlock>

                      <DroppableTimeBlock
                        date={selectedDate}
                        hour={hour}
                        minute={15}
                      >
                        <AddEventDialog
                          startDate={selectedDate}
                          startTime={{ hour, minute: 15 }}
                        >
                          <div className="absolute inset-x-0 top-[24px] h-[24px] cursor-pointer transition-colors hover:bg-accent" />
                        </AddEventDialog>
                      </DroppableTimeBlock>

                      <div className="pointer-events-none absolute inset-x-0 top-1/2 border-b border-dashed"></div>

                      <DroppableTimeBlock
                        date={selectedDate}
                        hour={hour}
                        minute={30}
                      >
                        <AddEventDialog
                          startDate={selectedDate}
                          startTime={{ hour, minute: 30 }}
                        >
                          <div className="absolute inset-x-0 top-[48px] h-[24px] cursor-pointer transition-colors hover:bg-accent" />
                        </AddEventDialog>
                      </DroppableTimeBlock>

                      <DroppableTimeBlock
                        date={selectedDate}
                        hour={hour}
                        minute={45}
                      >
                        <AddEventDialog
                          startDate={selectedDate}
                          startTime={{ hour, minute: 45 }}
                        >
                          <div className="absolute inset-x-0 top-[72px] h-[24px] cursor-pointer transition-colors hover:bg-accent" />
                        </AddEventDialog>
                      </DroppableTimeBlock>
                    </div>
                  )
                })}

                {groupedEvents.map((group, groupIndex) =>
                  group.map((event) => {
                    let style = getEventBlockStyle(
                      event,
                      selectedDate,
                      groupIndex,
                      groupedEvents.length,
                      { from: earliestEventHour, to: latestEventHour }
                    )
                    const hasOverlap = groupedEvents.some(
                      (otherGroup, otherIndex) =>
                        otherIndex !== groupIndex &&
                        otherGroup.some((otherEvent) =>
                          areIntervalsOverlapping(
                            {
                              start: parseISO(event.startDate),
                              end: parseISO(event.endDate),
                            },
                            {
                              start: parseISO(otherEvent.startDate),
                              end: parseISO(otherEvent.endDate),
                            }
                          )
                        )
                    )

                    if (!hasOverlap)
                      style = { ...style, width: "100%", left: "0%" }

                    return (
                      <div
                        key={event.id}
                        className="absolute p-1"
                        style={style}
                      >
                        <EventBlock event={event} />
                      </div>
                    )
                  })
                )}
              </div>

              <CalendarTimeline
                firstVisibleHour={earliestEventHour}
                lastVisibleHour={latestEventHour}
              />
            </div>
          </div>
        </ScrollArea>
      </div>

      <div className="hidden w-64 divide-y border-l md:block">
        <Calendar
          className="mx-auto w-fit"
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          autoFocus
        />

        <div className="flex-1 space-y-3">
          {currentEvents.length > 0 ? (
            <div className="flex items-start gap-2 px-4 pt-4">
              <span className="relative mt-[5px] flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex size-2.5 rounded-full bg-green-600"></span>
              </span>

              <p className="text-sm font-semibold text-foreground">
                {t("calendar.dayView.happeningNow")}
              </p>
            </div>
          ) : (
            <p className="p-4 text-center text-sm text-muted-foreground italic">
              {t("calendar.dayView.noAppointments")}
            </p>
          )}

          {currentEvents.length > 0 && (
            <ScrollArea className="h-[422px] px-4" type="always">
              <div className="space-y-6 pb-4">
                {currentEvents.map((event) => {
                  return (
                    <div key={event.id} className="space-y-1.5">
                      <p className="line-clamp-2 text-sm font-semibold">
                        {event.title}
                      </p>

                      {event.user?.name && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <UserIcon className="size-3.5" />
                          <span className="text-sm">{event.user.name}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CalendarIcon className="size-3.5" />
                        <span className="text-sm">
                          {format(new Date(), "MMM d, yyyy", { locale })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <ClockIcon className="size-3.5" />
                        <span className="text-sm">
                          {format(parseISO(event.startDate), timeFormat.time, {
                            locale,
                          })}{" "}
                          -{" "}
                          {format(parseISO(event.endDate), timeFormat.time, {
                            locale,
                          })}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  )
}
