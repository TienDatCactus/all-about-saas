import { AppConstants } from "@/lib/utils/constants";
import { storage } from "@/lib/utils/local-storage";
import { useMutation } from "@tanstack/react-query";
import {
  authApi,
  type ChangePasswordIn,
  type LoginIn,
  type SendVerificationEmailIn,
  type SignUpIn,
  type VerifyEmailIn,
} from ".";

export const useLoginMutation = () => {
  return useMutation({
    mutationFn: (data: LoginIn) => authApi.login(data),
    onSuccess: (res) => {
      storage.set(AppConstants.tokenKey, res);
    },
  });
};

export const useSignupMutation = () => {
  return useMutation({
    mutationFn: (data: Pick<SignUpIn, "email" | "password">) => authApi.signUp(data),
    onSuccess: (res) => {
      storage.set(AppConstants.tokenKey, res);
    },
  });
};

export const useGoogleLoginMutation = () => {
  return useMutation({
    mutationFn: () => authApi.loginWithGoogle(),
  });
};

export const useLogoutMutation = () => {
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      storage.remove(AppConstants.tokenKey);
    },
  });
};

export const useVerifyEmailMutation = () => {
  return useMutation({
    mutationFn: (data: VerifyEmailIn) => authApi.verifyEmail(data),
    onSuccess: () => {
      storage.remove(AppConstants.tokenKey);
    },
  });
};

export const useSendVerificationEmailMutation = () => {
  return useMutation({
    mutationFn: (data: SendVerificationEmailIn) => authApi.sendVerificationEmail(data),
  });
};

export const useChangePasswordMutation = () => {
  return useMutation({
    mutationFn: (data: Pick<ChangePasswordIn, "selector" | "token" | "password">) =>
      authApi.changePassword(data),
  });
};
