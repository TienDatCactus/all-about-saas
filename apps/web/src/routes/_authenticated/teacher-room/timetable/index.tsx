import TeacherTimetablePage from "@/pages/teacher-room/timetable"
import { createFileRoute } from "@tanstack/react-router"
import * as z from "zod"

const TeacherRoomSearchSchema = z.object({
  view: z.enum(["day", "week", "month", "year", "agenda"]).optional(),
  date: z.string().optional(),
})

export const Route = createFileRoute("/_authenticated/teacher-room/timetable/")(
  {
    staticData: { crumb: "Timetable" },
    component: TeacherTimetablePage,
    validateSearch: TeacherRoomSearchSchema,
  }
)
