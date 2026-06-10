import { http } from "@/lib/http";
import { AUTH } from "../url";
import type { LoginIn } from "./types";

export const authApi = {
  login: async (data: LoginIn): Promise<string> => {
    return http.post(AUTH.login, data);
  },
  logout: async (): Promise<void> => {
    return http.post(AUTH.logout);
  },
  loginWithGoogle: async (): Promise<void> => {
    window.location.href = AUTH.googleLogin;
  },
  refresh: async (): Promise<string> => {
    return http.post(AUTH.refresh);
  },
};
