import { AppConstants } from "@/lib/utils/constants";
import { storage } from "@/lib/utils/local-storage";
import { useMutation } from "@tanstack/react-query";
import { authApi, type LoginIn, type SignUpIn } from ".";

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
    mutationFn: (data: SignUpIn) => authApi.signUp(data),
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
