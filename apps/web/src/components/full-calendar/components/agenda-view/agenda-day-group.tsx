import { format, parseISO } from "date-fns"
import { useTranslation } from "react-i18next"

import { useDateFnsLocale, useTimeFormat } from "@/hooks/use-date-fns-locale"
import { EventDetailsDialog } from "../dialogs/event-details-dialog"
import { EVENT_TONE, STATUS_LABEL_KEY, TYPE_LABEL_KEY } from "../../adapter"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DataAvatar } from "@/components/custom/data/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { IEvent } from "../../interfaces"

interface IProps {
  date: Date
  events: IEvent[]
}

// Following https://reui.io/components/table's activity-log pattern: avatar
// + name, a status badge, a monospace-ish detail column, time right-aligned.
export function AgendaDayGroup({ date, events }: IProps) {
  const locale = useDateFnsLocale()
  const timeFormat = useTimeFormat()
  const { t } = useTranslation()
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  )

  if (sortedEvents.length === 0) return null

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      if (e.currentTarget instanceof HTMLElement) e.currentTarget.click()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="sticky top-0 flex items-center gap-4 bg-background py-2">
        <p className="text-sm font-semibold">
          {format(date, "EEEE, MMMM d, yyyy", { locale })}
        </p>
      </div>

      <Card className="gap-0 overflow-hidden !p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("calendar.agenda.columnStudent")}</TableHead>
              {/* Least essential column at a glance — dropped first so the
                  row still fits a phone screen without horizontal scroll. */}
              <TableHead className="hidden @sm:table-cell">
                {t("calendar.agenda.columnType")}
              </TableHead>
              <TableHead>{t("calendar.agenda.columnStatus")}</TableHead>
              <TableHead className="text-right">
                {t("calendar.agenda.columnTime")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEvents.map((event) => {
              const tone = EVENT_TONE[event.color]
              const start = parseISO(event.startDate)
              const end = parseISO(event.endDate)

              return (
                <EventDetailsDialog key={event.id} event={event}>
                  <TableRow
                    role="button"
                    tabIndex={0}
                    onKeyDown={handleKeyDown}
                    className="h-16 cursor-pointer"
                  >
                    <TableCell className="px-2 @sm:px-3">
                      <div className="flex items-center gap-2 @sm:gap-3">
                        <DataAvatar
                          item={event}
                          getName={(e) => e.title}
                          size="sm"
                        />
                        <span className="text-sm font-medium">
                          {event.title}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden @sm:table-cell">
                      <Badge variant="secondary">
                        {t(TYPE_LABEL_KEY[event.session.type])}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-2 @sm:px-3">
                      <Badge variant="outline" className={tone.surface}>
                        {t(STATUS_LABEL_KEY[event.session.status])}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-2 text-right text-sm text-muted-foreground @sm:px-3">
                      {format(start, timeFormat.time, { locale })}
                      {/* End time only where there's room to spare — the
                          start time alone still answers "when". */}
                      <span className="hidden @sm:inline">
                        {" "}
                        – {format(end, timeFormat.time, { locale })}
                      </span>
                    </TableCell>
                  </TableRow>
                </EventDetailsDialog>
              )
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
