import { http } from "@/lib/utils/http";
import { AUTH } from "../url";
import type { LoginIn } from "./types";

export const usersApi = {
  login: async (data: LoginIn): Promise<string> => {
    return http.post(AUTH.login, data);
  },
  logout: async (): Promise<void> => {},
  loginWithGoogle: async (): Promise<void> => {
    window.location.href = AUTH.googleLogin;
  },
};
