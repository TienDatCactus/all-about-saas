import { http } from "@/lib/utils/http";
import { AUTH } from "../url";
import type { LoginIn, SignUpIn } from "./types";

export const authApi = {
  login: async (data: LoginIn): Promise<string> => {
    return http.post(AUTH.login, data);
  },
  logout: async (): Promise<void> => {
    return http.post(AUTH.logout);
  },
  signUp: async (data: SignUpIn): Promise<void> => {
    return http.post(AUTH.signup, data);
  },
  loginWithGoogle: async (): Promise<void> => {
    window.location.href = AUTH.googleLogin;
  },
  refresh: async (): Promise<string> => {
    return http.post(AUTH.refresh);
  },
};
