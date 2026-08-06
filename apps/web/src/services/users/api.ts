import { http } from "@/lib/utils/http"
import { parseResponse } from "@/lib/utils/parse-response"
import { USERS } from "../url"
import { MeSchema, type Me } from "./types"

export const usersApi = {
  me: (): Promise<Me> =>
    parseResponse("users.me", MeSchema, http.get(USERS.me)),
}
