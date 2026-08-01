import * as z from "zod"
import { AUTH } from "../url"
import type {
  ChangePasswordIn,
  LoginIn,
  ResetPasswordIn,
  SendVerificationEmailIn,
  SignUpIn,
  VerifyEmailIn,
} from "./types"
import { http } from "@/lib/utils/http"
import { parseResponse } from "@/lib/utils/parse-response"

/**
 * What login and refresh actually put on the wire. The old
 * `{ accessToken: string } | string` union plus a typeof check wasn't a
 * contract — it was two guesses with a runtime coin-flip between them. If the
 * API drifts, parseResponse fails loudly at the boundary instead of handing a
 * garbage "token" to the Authorization header.
 */
const AccessTokenSchema = z.object({ accessToken: z.string().min(1) })

export const authApi = {
  login: (data: LoginIn): Promise<string> =>
    parseResponse(
      "auth.login",
      AccessTokenSchema,
      http.post(AUTH.login, data)
    ).then((r) => r.accessToken),
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
  refresh: (): Promise<string> =>
    parseResponse(
      "auth.refresh",
      AccessTokenSchema,
      http.post(AUTH.refresh)
    ).then((r) => r.accessToken),
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
