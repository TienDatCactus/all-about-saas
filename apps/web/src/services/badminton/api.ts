import { BADMINTON } from "../url"
import {
  BadmintonSessionSchema,
  DeletedIdSchema,
  ParticipantSuggestionSchema,
  PublicSessionSchema,
  SessionListItemSchema,
} from "./types"
import type { CreateSessionIn, UpdateSessionIn } from "./types"
import type { PageParams } from "../utils"
import { paginatedSchema, parseResponse } from "@/lib/utils/parse-response"
import { http } from "@/lib/utils/http"

/**
 * Every response goes through its schema, so the return types below are checked
 * against the wire rather than asserted over it. Return types are inferred from
 * the schemas — deliberately not annotated, which would let an annotation and a
 * schema disagree again.
 */
export const badmintonApi = {
  list: (params?: PageParams) =>
    parseResponse(
      "badminton.list",
      paginatedSchema(SessionListItemSchema),
      http.get(BADMINTON.sessions, { params })
    ),
  get: (id: string) =>
    parseResponse(
      "badminton.get",
      BadmintonSessionSchema,
      http.get(BADMINTON.session(id))
    ),
  create: (data: CreateSessionIn) =>
    parseResponse(
      "badminton.create",
      BadmintonSessionSchema,
      http.post(BADMINTON.sessions, data)
    ),
  update: (id: string, data: UpdateSessionIn) =>
    parseResponse(
      "badminton.update",
      BadmintonSessionSchema,
      http.patch(BADMINTON.session(id), data)
    ),
  remove: (id: string) =>
    parseResponse(
      "badminton.remove",
      DeletedIdSchema,
      http.delete(BADMINTON.session(id))
    ),
  suggest: (q: string) =>
    parseResponse(
      "badminton.suggest",
      ParticipantSuggestionSchema,
      http.get(BADMINTON.suggest, { params: { q } })
    ),
  getByShareToken: (shareToken: string) =>
    parseResponse(
      "badminton.getByShareToken",
      PublicSessionSchema,
      http.get(BADMINTON.publicSession(shareToken))
    ),
}
