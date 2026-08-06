import { useQuery } from "@tanstack/react-query"
import { usersApi } from "./api"
import { hasSessionHint } from "@/lib/utils/access-token"

export const ME_QUERY_KEY = ["users", "me"] as const

export const useMeQuery = () => {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => usersApi.me(),
    enabled: hasSessionHint(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
