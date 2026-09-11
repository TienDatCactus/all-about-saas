import { TEACHER_ROOM } from "../url"
import {
  StudentSuggestionSchema,
  WeeklyScheduleSlotSchema,
  TeachingSessionSchema,
  TeachingSessionHistorySchema,
} from "./types"
import type {
  CreateSlotIn,
  UpdateSlotIn,
  CreateAdHocSessionIn,
  RescheduleSessionIn,
} from "./types"
import { parseResponse, paginatedSchema } from "@/lib/utils/parse-response"
import { http } from "@/lib/utils/http"
import * as z from "zod"

export const teacherRoomApi = {
  suggestStudents: (q: string) =>
    parseResponse(
      "teacherRoom.suggestStudents",
      z.array(StudentSuggestionSchema),
      http.get(TEACHER_ROOM.studentSuggest, { params: { q } })
    ),

  listSlots: (studentId?: string) =>
    parseResponse(
      "teacherRoom.listSlots",
      paginatedSchema(WeeklyScheduleSlotSchema),
      http.get(TEACHER_ROOM.slots, { params: { studentId, limit: 100 } })
    ),
  createSlot: (data: CreateSlotIn) =>
    parseResponse(
      "teacherRoom.createSlot",
      WeeklyScheduleSlotSchema,
      http.post(TEACHER_ROOM.slots, data)
    ),
  updateSlot: (id: string, data: UpdateSlotIn) =>
    parseResponse(
      "teacherRoom.updateSlot",
      WeeklyScheduleSlotSchema,
      http.patch(TEACHER_ROOM.slot(id), data)
    ),

  listSessionsInRange: (from: string, to: string) =>
    parseResponse(
      "teacherRoom.listSessionsInRange",
      z.array(TeachingSessionSchema),
      http.get(TEACHER_ROOM.sessions, { params: { from, to } })
    ),
  pendingToday: () =>
    parseResponse(
      "teacherRoom.pendingToday",
      z.array(TeachingSessionSchema),
      http.get(TEACHER_ROOM.sessionsPendingToday)
    ),
  sessionHistory: (id: string) =>
    parseResponse(
      "teacherRoom.sessionHistory",
      z.array(TeachingSessionHistorySchema),
      http.get(TEACHER_ROOM.sessionHistory(id))
    ),
  createAdHocSession: (data: CreateAdHocSessionIn) =>
    parseResponse(
      "teacherRoom.createAdHocSession",
      TeachingSessionSchema,
      http.post(TEACHER_ROOM.sessions, data)
    ),
  rescheduleSession: (id: string, data: RescheduleSessionIn) =>
    parseResponse(
      "teacherRoom.rescheduleSession",
      TeachingSessionSchema,
      http.patch(TEACHER_ROOM.sessionReschedule(id), data)
    ),
  cancelSession: (id: string, note?: string) =>
    parseResponse(
      "teacherRoom.cancelSession",
      TeachingSessionSchema,
      http.patch(TEACHER_ROOM.sessionCancel(id), { note })
    ),
  completeSession: (id: string, note?: string) =>
    parseResponse(
      "teacherRoom.completeSession",
      TeachingSessionSchema,
      http.patch(TEACHER_ROOM.sessionComplete(id), { note })
    ),
  reopenSession: (id: string, note?: string) =>
    parseResponse(
      "teacherRoom.reopenSession",
      TeachingSessionSchema,
      http.patch(TEACHER_ROOM.sessionReopen(id), { note })
    ),
  setSessionPriority: (id: string, priority: "low" | "normal" | "high") =>
    parseResponse(
      "teacherRoom.setSessionPriority",
      TeachingSessionSchema,
      http.patch(TEACHER_ROOM.sessionPriority(id), { priority })
    ),
}
