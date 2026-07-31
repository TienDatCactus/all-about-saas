import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { badmintonApi } from "./api"
import type { CreateSessionIn, SessionListItem, UpdateSessionIn } from "./types"
import { toast } from "@/components/custom/toast"
import type { PageParams, Paginated } from "../utils"

export const badmintonKeys = {
  all: ["badminton"] as const,
  /** Prefix for every page of the list — use this to invalidate them all. */
  sessions: () => [...badmintonKeys.all, "sessions"] as const,
  /** One specific page. Params are part of the key so pages cache separately. */
  sessionsPage: (params: PageParams = {}) =>
    [...badmintonKeys.sessions(), params] as const,
  session: (id: string) => [...badmintonKeys.all, "session", id] as const,
  publicSession: (token: string) =>
    [...badmintonKeys.all, "public", token] as const,
  suggest: (q: string) => [...badmintonKeys.all, "suggest", q] as const,
}

export const useSessionsQuery = (params: PageParams = {}) => {
  return useQuery({
    queryKey: badmintonKeys.sessionsPage(params),
    queryFn: () => badmintonApi.list(params),
    // Keep the current page on screen while the next one loads, so paging
    // doesn't tear the list down to a skeleton on every click.
    placeholderData: keepPreviousData,
  })
}

export const useSessionQuery = (id: string, enabled = true) => {
  return useQuery({
    queryKey: badmintonKeys.session(id),
    queryFn: () => badmintonApi.get(id),
    enabled: enabled && !!id,
  })
}

export const usePublicSessionQuery = (shareToken: string) => {
  return useQuery({
    queryKey: badmintonKeys.publicSession(shareToken),
    queryFn: () => badmintonApi.getByShareToken(shareToken),
    enabled: !!shareToken,
  })
}

export const useParticipantSuggestions = (q: string, enabled = true) => {
  return useQuery({
    queryKey: badmintonKeys.suggest(q),
    queryFn: () => badmintonApi.suggest(q),
    enabled: enabled && q.trim().length > 0,
    staleTime: 30_000,
  })
}

export const useCreateSessionMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSessionIn) => badmintonApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: badmintonKeys.sessions() })
    },
  })
}

export const useUpdateSessionMutation = (id: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateSessionIn) => badmintonApi.update(id, data),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: badmintonKeys.sessions() })
      queryClient.setQueryData(badmintonKeys.session(id), session)
    },
  })
}

export const useDeleteSessionMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => badmintonApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: badmintonKeys.sessions() })
    },
  })
}

const UNDO_WINDOW_MS = 5000

/**
 * Just the two fields this reads. It is called from the list, whose rows are
 * `SessionListItem` — asking for a full `BadmintonSession` demanded `ownerId`,
 * `shareToken` and `updatedAt` that the list endpoint never sends.
 */
type DeletableSession = Pick<SessionListItem, "id" | "title">

export function useUndoableDeleteSession() {
  const queryClient = useQueryClient()
  const { mutate: commitDelete } = useDeleteSessionMutation()

  return (session: DeletableSession) => {
    queryClient.setQueriesData<Paginated<SessionListItem>>(
      { queryKey: badmintonKeys.sessions() },
      (prev) =>
        prev
          ? {
              ...prev,
              data: prev.data.filter((s) => s.id !== session.id),
              total: Math.max(0, prev.total - 1),
            }
          : prev
    )

    let undone = false
    toast({
      status: "info",
      title: `Deleted "${session.title || "Untitled session"}"`,
      description: "You can undo this until the message closes.",
      duration: UNDO_WINDOW_MS,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true
          queryClient.invalidateQueries({
            queryKey: badmintonKeys.sessions(),
          })
        },
      },

      onDismiss: () => {
        if (undone) return
        commitDelete(session.id, {
          onError: () => {
            queryClient.invalidateQueries({
              queryKey: badmintonKeys.sessions(),
            })
          },
        })
      },
    })
  }
}
