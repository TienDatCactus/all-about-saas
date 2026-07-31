import { http } from "@/lib/utils/http"
import { AUTH } from "../url"
import type {
  ChangePasswordIn,
  LoginIn,
  ResetPasswordIn,
  SendVerificationEmailIn,
  SignUpIn,
  VerifyEmailIn,
} from "./types"

export const authApi = {
  login: async (data: LoginIn): Promise<string> => {
    const res = await http.post<{ accessToken: string } | string>(
      AUTH.login,
      data
    )
    return typeof res === "string" ? res : res.accessToken
  },
  logout: async (): Promise<void> => {
    return http.post(AUTH.logout)
  },
  signUp: async (data: Pick<SignUpIn, "email" | "password">): Promise<void> => {
    return http.post(AUTH.signup, data)
  },
  loginWithGoogle: async (): Promise<void> => {
    window.location.href = AUTH.googleLogin
  },
  loginWithGithub: async (): Promise<void> => {
    window.location.href = AUTH.githubLogin
  },
  loginWithFacebook: async (): Promise<void> => {
    window.location.href = AUTH.facebookLogin
  },
  refresh: async (): Promise<string> => {
    const res = await http.post<{ accessToken: string } | string>(AUTH.refresh)
    return typeof res === "string" ? res : res.accessToken
  },
  verifyEmail: async (data: VerifyEmailIn) => {
    return http.post(AUTH.verifyEmail, data)
  },
  sendVerificationEmail: async (
    data: SendVerificationEmailIn
  ): Promise<void> => {
    return http.post(AUTH.sendVerificationEmail, data)
  },
  /** Finish a forgotten-password reset using the emailed selector + token. */
  resetPassword: async (
    data: Pick<ResetPasswordIn, "selector" | "token" | "password">
  ): Promise<void> => {
    return http.post(AUTH.resetPassword, data)
  },
  /**
   * Change the signed-in user's own password. The account comes from the JWT;
   * `currentPassword` is the second factor, and the server revokes every other
   * session on success.
   */
  changePassword: async (
    data: Pick<ChangePasswordIn, "currentPassword" | "newPassword">
  ): Promise<void> => {
    return http.post(AUTH.changePassword, data)
  },
}
