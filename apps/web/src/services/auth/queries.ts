import { AppConstants } from "@/lib/utils/constants"
import { storage } from "@/lib/utils/local-storage"
import { useMutation } from "@tanstack/react-query"
import {
  authApi,
  type LoginIn,
  type ResetPasswordIn,
  type SendVerificationEmailIn,
  type SignUpIn,
  type VerifyEmailIn,
} from "."

export const useLoginMutation = () => {
  return useMutation({
    mutationFn: (data: LoginIn) => authApi.login(data),
    onSuccess: (res) => {
      storage.set(AppConstants.tokenKey, res)
    },
  })
}

export const useSignupMutation = () => {
  return useMutation({
    mutationFn: (data: Pick<SignUpIn, "email" | "password">) =>
      authApi.signUp(data),
    onSuccess: (res) => {
      storage.set(AppConstants.tokenKey, res)
    },
  })
}

export const useLogoutMutation = () => {
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      storage.remove(AppConstants.tokenKey)
    },
  })
}

export const useVerifyEmailMutation = () => {
  return useMutation({
    mutationFn: (data: VerifyEmailIn) => authApi.verifyEmail(data),
    onSuccess: () => {
      storage.remove(AppConstants.tokenKey)
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
