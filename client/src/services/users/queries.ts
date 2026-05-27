import { storage } from "@/lib/local-storage"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { usersApi, type LoginIn } from "."

export const userKeys = {
  all: ["users"] as const,
  profile: () => [...userKeys.all, "profile"] as const,
  list: () => [...userKeys.all, "list"] as const,
  detail: (id: number) => [...userKeys.all, "detail", id] as const,
}

export const useLoginMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: LoginIn) => usersApi.login(data),
    onSuccess: (res) => {
      storage.set("access_token", res)
      queryClient.invalidateQueries({ queryKey: userKeys.profile() })
    },
  })
}
