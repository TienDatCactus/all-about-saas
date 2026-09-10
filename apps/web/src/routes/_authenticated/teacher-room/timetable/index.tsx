import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import * as z from "zod";
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";

import { PageHeader } from "@/components/custom/page-shell/page-header";
import { useSearchParamsSetter } from "@/hooks/use-search-params-setter";
import { useSessionsRangeQuery } from "@/services/teacher-room/queries";
import { sessionToEvent } from "@/components/full-calendar/adapter";
import { CalendarProvider } from "@/components/full-calendar/contexts/calendar-context";
import { ClientContainer } from "@/components/full-calendar/components/client-container";
import type { TCalendarView } from "@/components/full-calendar/types";

const TeacherRoomSearchSchema = z.object({
  view: z.enum(["day", "week", "month", "year", "agenda"]).optional(),
  date: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/teacher-room/timetable/")(
  {
    staticData: { crumb: "Timetable" },
    component: RouteComponent,
    validateSearch: TeacherRoomSearchSchema,
  },
);

const DATE_FMT = "yyyy-MM-dd";

/** Same per-view windowing ClientContainer applies client-side — the fetch
 *  just needs to cover at least that window. */
function rangeForView(view: TCalendarView, selectedDate: Date) {
  switch (view) {
    case "day":
      return {
        from: format(selectedDate, DATE_FMT),
        to: format(selectedDate, DATE_FMT),
      };
    case "week":
      return {
        from: format(startOfWeek(selectedDate), DATE_FMT),
        to: format(endOfWeek(selectedDate), DATE_FMT),
      };
    case "year":
      return {
        from: format(startOfYear(selectedDate), DATE_FMT),
        to: format(endOfYear(selectedDate), DATE_FMT),
      };
    case "month":
    case "agenda":
    default:
      return {
        from: format(startOfMonth(selectedDate), DATE_FMT),
        to: format(endOfMonth(selectedDate), DATE_FMT),
      };
  }
}

function RouteComponent() {
  const { view = "week", date } = Route.useSearch();
  const setSearchParams = useSearchParamsSetter();

  const selectedDate = date ? parseISO(date) : new Date();
  const { from, to } = rangeForView(view, selectedDate);

  const sessionsQuery = useSessionsRangeQuery(from, to);
  const events = useMemo(
    () => (sessionsQuery.data ?? []).map(sessionToEvent),
    [sessionsQuery.data],
  );

  return (
    <>
      <PageHeader
        title="Lịch dạy"
        description="Lịch dạy và các buổi học sắp tới."
      />
      <CalendarProvider
        events={events}
        selectedDate={selectedDate}
        onSelectedDateChange={(next) =>
          setSearchParams({ date: format(next, DATE_FMT) })
        }
      >
        <ClientContainer view={view} />
      </CalendarProvider>
    </>
  );
}
