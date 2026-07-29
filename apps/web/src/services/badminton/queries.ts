import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { badmintonApi } from "./api";
import type { CreateSessionIn, UpdateSessionIn } from "./types";

export const badmintonKeys = {
  all: ["badminton"] as const,
  sessions: () => [...badmintonKeys.all, "sessions"] as const,
  session: (id: string) => [...badmintonKeys.all, "session", id] as const,
  publicSession: (token: string) =>
    [...badmintonKeys.all, "public", token] as const,
  suggest: (q: string) => [...badmintonKeys.all, "suggest", q] as const,
};

export const useSessionsQuery = () => {
  return useQuery({
    queryKey: badmintonKeys.sessions(),
    queryFn: () => badmintonApi.list(),
  });
};

export const useSessionQuery = (id: string, enabled = true) => {
  return useQuery({
    queryKey: badmintonKeys.session(id),
    queryFn: () => badmintonApi.get(id),
    enabled: enabled && !!id,
  });
};

export const usePublicSessionQuery = (shareToken: string) => {
  return useQuery({
    queryKey: badmintonKeys.publicSession(shareToken),
    queryFn: () => badmintonApi.getByShareToken(shareToken),
    enabled: !!shareToken,
  });
};

export const useParticipantSuggestions = (q: string, enabled = true) => {
  return useQuery({
    queryKey: badmintonKeys.suggest(q),
    queryFn: () => badmintonApi.suggest(q),
    enabled: enabled && q.trim().length > 0,
    staleTime: 30_000,
  });
};

export const useCreateSessionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSessionIn) => badmintonApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: badmintonKeys.sessions() });
    },
  });
};

export const useUpdateSessionMutation = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateSessionIn) => badmintonApi.update(id, data),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: badmintonKeys.sessions() });
      queryClient.setQueryData(badmintonKeys.session(id), session);
    },
  });
};

export const useDeleteSessionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => badmintonApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: badmintonKeys.sessions() });
    },
  });
};
