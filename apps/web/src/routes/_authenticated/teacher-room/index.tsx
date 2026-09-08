import { createFileRoute } from "@tanstack/react-router"
import TeacherRoomCalendarPage from "@/pages/teacher-room/calendar"

export const Route = createFileRoute("/_authenticated/teacher-room/")({
  staticData: { crumb: "Lịch dạy" },
  component: TeacherRoomCalendarPage,
})
