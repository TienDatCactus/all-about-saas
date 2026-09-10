import TeacherTimetablePage from "@/pages/teacher-room/timetable"
import { createFileRoute } from "@tanstack/react-router"
import * as z from "zod"
import i18n from "@/lib/i18n"

const TeacherRoomSearchSchema = z.object({
  view: z.enum(["day", "week", "month", "year", "agenda"]).optional(),
  date: z.string().optional(),
})

export const Route = createFileRoute("/_authenticated/teacher-room/timetable/")(
  {
    staticData: { crumb: () => i18n.t("teacherRoom.timetable.crumb") },
    component: TeacherTimetablePage,
    validateSearch: TeacherRoomSearchSchema,
  }
)
