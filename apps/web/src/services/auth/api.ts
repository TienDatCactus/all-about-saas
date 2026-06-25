import { http } from "@/lib/utils/http";
import { AUTH } from "../url";
import type {
  LoginIn,
  SendVerificationEmailIn,
  SignUpIn,
  VerifyEmailIn,
} from "./types";

export const authApi = {
  login: async (data: LoginIn): Promise<string> => {
    return http.post(AUTH.login, data);
  },
  logout: async (): Promise<void> => {
    return http.post(AUTH.logout);
  },
  signUp: async (data: Pick<SignUpIn, "email" | "password">): Promise<void> => {
    return http.post(AUTH.signup, data);
  },
  loginWithGoogle: async (): Promise<void> => {
    window.location.href = AUTH.googleLogin;
  },
  refresh: async (): Promise<string> => {
    return http.post(AUTH.refresh);
  },
  verifyEmail: async (data: VerifyEmailIn) => {
    return http.post(AUTH.verifyEmail, data);
  },
  sendVerificationEmail: async (
    data: SendVerificationEmailIn,
  ): Promise<void> => {
    return http.post(AUTH.sendVerificationEmail, data);
  },
};
