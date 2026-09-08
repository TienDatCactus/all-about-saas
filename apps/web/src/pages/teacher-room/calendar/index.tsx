import DataPage from "@/components/custom/data/page"
import { Button } from "@/components/ui/button"
import { useSessionsRangeQuery } from "@/services/teacher-room/queries"
import { PendingTodayBanner } from "./components/pending-today-banner"
import { CalendarWeekGrid } from "./components/calendar-week-grid"
import { AdHocSessionDialog } from "./components/ad-hoc-session-dialog"
import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  startOfWeek,
  subWeeks,
} from "date-fns"
import { useState } from "react"

export default function TeacherRoomCalendarPage() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  const from = format(weekStart, "yyyy-MM-dd")
  const to = format(weekEnd, "yyyy-MM-dd")

  const sessionsQuery = useSessionsRangeQuery(from, to)
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const [addingSessionFor, setAddingSessionFor] = useState<string | undefined>()

  return (
    <>
      <DataPage
        query={sessionsQuery}
        title={`Lịch dạy tuần ${format(weekStart, "dd/MM")} – ${format(weekEnd, "dd/MM")}`}
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setWeekStart((d) => subWeeks(d, 1))}
            >
              Tuần trước
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
              }
            >
              Hôm nay
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setWeekStart((d) => addWeeks(d, 1))}
            >
              Tuần sau
            </Button>
          </div>
        }
        error={{ title: "Không tải được lịch dạy" }}
      >
        {(sessions) => (
          <div className="flex flex-col gap-6">
            <PendingTodayBanner />
            <CalendarWeekGrid
              days={days}
              sessions={sessions}
              onAddSession={setAddingSessionFor}
            />
          </div>
        )}
      </DataPage>
      {addingSessionFor && (
        <AdHocSessionDialog
          scheduledDate={addingSessionFor}
          open={true}
          onOpenChange={(open) => !open && setAddingSessionFor(undefined)}
        />
      )}
    </>
  )
}
