import { useMutation } from "@tanstack/react-query"
import { authApi } from "."
import type {
  LoginIn,
  ResetPasswordIn,
  SendVerificationEmailIn,
  SignUpIn,
  VerifyEmailIn,
} from "."
import { clearAccessToken, setAccessToken } from "@/lib/utils/access-token"

export const useLoginMutation = () => {
  return useMutation({
    mutationFn: (data: LoginIn) => authApi.login(data),
    // Memory, not localStorage — see access-token.ts. The refresh cookie set
    // by the same response is what survives a reload.
    onSuccess: (token) => {
      setAccessToken(token)
    },
  })
}

export const useSignupMutation = () => {
  return useMutation({
    mutationFn: (data: Pick<SignUpIn, "email" | "password">) =>
      authApi.signUp(data),
    // No onSuccess on purpose. signUp returns nothing (the account needs email
    // verification before it can log in) — the old handler stored that
    // `undefined` under the access-token key, which was never a token.
  })
}

export const useLogoutMutation = () => {
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      clearAccessToken()
    },
  })
}

export const useVerifyEmailMutation = () => {
  return useMutation({
    mutationFn: (data: VerifyEmailIn) => authApi.verifyEmail(data),
    onSuccess: () => {
      clearAccessToken()
    },
  })
}

export const useSendVerificationEmailMutation = () => {
  return useMutation({
    mutationFn: (data: SendVerificationEmailIn) =>
      authApi.sendVerificationEmail(data),
  })
}

/**
 * Completes a forgotten-password reset with the emailed selector + token.
 * Was `useChangePasswordMutation`, which described the in-session operation.
 */
export const useResetPasswordMutation = () => {
  return useMutation({
    mutationFn: (
      data: Pick<ResetPasswordIn, "selector" | "token" | "password">
    ) => authApi.resetPassword(data),
  })
}
