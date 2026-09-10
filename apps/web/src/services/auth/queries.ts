import { useMutation, useQueryClient } from "@tanstack/react-query"
import { usersApi } from "../users/api"
import { ME_QUERY_KEY } from "../users/queries"
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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: LoginIn) => authApi.login(data),
    onSuccess: (token) => {
      setAccessToken(token)
      void queryClient.fetchQuery({
        queryKey: ME_QUERY_KEY,
        queryFn: () => usersApi.me(),
        staleTime: 0,
      })
    },
  })
}

export const useSignupMutation = () => {
  return useMutation({
    mutationFn: (data: Pick<SignUpIn, "email" | "password">) =>
      authApi.signUp(data),
  })
}

export const useLogoutMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      clearAccessToken()
      queryClient.removeQueries({ queryKey: ME_QUERY_KEY })
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
