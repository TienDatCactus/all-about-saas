import { http } from "@/lib/utils/http"
import { BADMINTON } from "../url"
import type {
  BadmintonSession,
  CreateSessionIn,
  ParticipantSuggestion,
  PublicSession,
  UpdateSessionIn,
} from "./types"
import type { PageParams, Paginated } from "../utils"

export const badmintonApi = {
  list: async (params?: PageParams): Promise<Paginated<BadmintonSession>> => {
    return http.get(BADMINTON.sessions, { params })
  },
  get: async (id: string): Promise<BadmintonSession> => {
    return http.get(BADMINTON.session(id))
  },
  create: async (data: CreateSessionIn): Promise<BadmintonSession> => {
    return http.post(BADMINTON.sessions, data)
  },
  update: async (
    id: string,
    data: UpdateSessionIn
  ): Promise<BadmintonSession> => {
    return http.patch(BADMINTON.session(id), data)
  },
  remove: async (id: string): Promise<{ id: string }> => {
    return http.delete(BADMINTON.session(id))
  },
  suggest: async (q: string): Promise<ParticipantSuggestion> => {
    return http.get(BADMINTON.suggest, { params: { q } })
  },
  getByShareToken: async (shareToken: string): Promise<PublicSession> => {
    return http.get(BADMINTON.publicSession(shareToken))
  },
}
