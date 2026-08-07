import { USERS } from "../url";
import { parseResponse } from "@/lib/utils/parse-response";
import { MeSchema, type Me } from "./types";
import { http } from "@/lib/utils/http";

export const usersApi = {
  me: (): Promise<Me> =>
    parseResponse("users.me", MeSchema, http.get(USERS.me)),
};
