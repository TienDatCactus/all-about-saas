import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { teacherRoomApi } from "./api"
import type {
  CreateSlotIn,
  UpdateSlotIn,
  CreateAdHocSessionIn,
  RescheduleSessionIn,
} from "./types"

export const teacherRoomKeys = {
  all: ["teacherRoom"] as const,
  studentSuggest: (q: string) =>
    [...teacherRoomKeys.all, "studentSuggest", q] as const,
  slots: (studentId?: string) =>
    [...teacherRoomKeys.all, "slots", studentId ?? "all"] as const,
  sessionsRange: (from: string, to: string) =>
    [...teacherRoomKeys.all, "sessions", from, to] as const,
  pendingToday: () =>
    [...teacherRoomKeys.all, "sessions", "pending-today"] as const,
  sessionHistory: (id: string) =>
    [...teacherRoomKeys.all, "sessionHistory", id] as const,
}

// Mirrors badminton's useParticipantSuggestions (apps/web/src/services/badminton/queries.ts):
// same 2-char gate and debounce-friendly staleTime, so a combobox doesn't
// fire a request per keystroke or refetch identical queries while typing.
export const useStudentSuggestQuery = (q: string, enabled = true) =>
  useQuery({
    queryKey: teacherRoomKeys.studentSuggest(q),
    queryFn: () => teacherRoomApi.suggestStudents(q),
    enabled: enabled && q.trim().length >= 2,
    staleTime: 30_000,
  })

export const useSlotsQuery = (studentId?: string) =>
  useQuery({
    queryKey: teacherRoomKeys.slots(studentId),
    queryFn: () => teacherRoomApi.listSlots(studentId),
  })

// No studentId param — there's no per-student page anymore (Task 18 lists
// every slot on one screen), so invalidating the whole teacherRoom cache is
// both simpler and correct.
export const useCreateSlotMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSlotIn) => teacherRoomApi.createSlot(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teacherRoomKeys.all })
    },
  })
}

export const useUpdateSlotMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSlotIn }) =>
      teacherRoomApi.updateSlot(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teacherRoomKeys.all })
    },
  })
}

export const useSessionsRangeQuery = (from: string, to: string) =>
  useQuery({
    queryKey: teacherRoomKeys.sessionsRange(from, to),
    queryFn: () => teacherRoomApi.listSessionsInRange(from, to),
    enabled: !!from && !!to,
  })

export const usePendingTodayQuery = () =>
  useQuery({
    queryKey: teacherRoomKeys.pendingToday(),
    queryFn: () => teacherRoomApi.pendingToday(),
  })

export const useSessionHistoryQuery = (id: string, enabled = true) =>
  useQuery({
    queryKey: teacherRoomKeys.sessionHistory(id),
    queryFn: () => teacherRoomApi.sessionHistory(id),
    enabled: enabled && !!id,
  })

function invalidateSessionQueries(
  queryClient: ReturnType<typeof useQueryClient>
) {
  void queryClient.invalidateQueries({ queryKey: teacherRoomKeys.all })
}

export const useCreateAdHocSessionMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateAdHocSessionIn) =>
      teacherRoomApi.createAdHocSession(data),
    onSuccess: () => invalidateSessionQueries(queryClient),
  })
}

export const useRescheduleSessionMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RescheduleSessionIn }) =>
      teacherRoomApi.rescheduleSession(id, data),
    onSuccess: () => invalidateSessionQueries(queryClient),
  })
}

export const useCancelSessionMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      teacherRoomApi.cancelSession(id, note),
    onSuccess: () => invalidateSessionQueries(queryClient),
  })
}

export const useCompleteSessionMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      teacherRoomApi.completeSession(id, note),
    onSuccess: () => invalidateSessionQueries(queryClient),
  })
}

export const useReopenSessionMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      teacherRoomApi.reopenSession(id, note),
    onSuccess: () => invalidateSessionQueries(queryClient),
  })
}

export const useSetPriorityMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      priority,
    }: {
      id: string
      priority: "low" | "normal" | "high"
    }) => teacherRoomApi.setSessionPriority(id, priority),
    onSuccess: () => invalidateSessionQueries(queryClient),
  })
}
