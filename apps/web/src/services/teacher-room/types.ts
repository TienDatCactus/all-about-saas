import * as z from "zod"

export const StudentSuggestionSchema = z.object({
  id: z.string(),
  name: z.string(),
})
export type StudentSuggestion = z.infer<typeof StudentSuggestionSchema>

export const WeeklyScheduleSlotSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  student: z.object({ id: z.string(), name: z.string() }).optional(),
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string(),
  endTime: z.string(),
  active: z.boolean(),
})
export type WeeklyScheduleSlot = z.infer<typeof WeeklyScheduleSlotSchema>

export const CreateSlotSchema = z.object({
  studentName: z.string().min(1, "Student name is required").max(120),
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string(),
  endTime: z.string(),
})
export type CreateSlotIn = z.infer<typeof CreateSlotSchema>
export type UpdateSlotIn = Partial<Omit<CreateSlotIn, "studentName">> & {
  active?: boolean
}

export const SessionStatusSchema = z.enum([
  "scheduled",
  "completed",
  "cancelled",
])
export const SessionTypeSchema = z.enum(["regular", "makeup", "extra"])
export const SessionPrioritySchema = z.enum(["low", "normal", "high"])

export const TeachingSessionSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  student: z.object({ id: z.string(), name: z.string() }).optional(),
  slotId: z.string().nullish(),
  scheduledDate: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  status: SessionStatusSchema,
  type: SessionTypeSchema,
  priority: SessionPrioritySchema,
  note: z.string().nullish(),
  confirmedAt: z.string().nullish(),
})
export type TeachingSession = z.infer<typeof TeachingSessionSchema>

export const TeachingSessionHistorySchema = z.object({
  id: z.string(),
  action: z.enum([
    "created",
    "rescheduled",
    "cancelled",
    "completed",
    "reopened",
    "note_updated",
    "priority_changed",
  ]),
  fromDate: z.string().nullish(),
  toDate: z.string().nullish(),
  note: z.string().nullish(),
  createdAt: z.string(),
})
export type TeachingSessionHistory = z.infer<
  typeof TeachingSessionHistorySchema
>

export const CreateAdHocSessionSchema = z.object({
  studentName: z.string().min(1, "Student name is required").max(120),
  scheduledDate: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  note: z.string().max(2000).optional(),
})
export type CreateAdHocSessionIn = z.infer<typeof CreateAdHocSessionSchema>

export interface RescheduleSessionIn {
  newDate: string
  newStartTime?: string
  newEndTime?: string
  note?: string
}
