import { storage } from "@/lib/utils/local-storage";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi, type LoginIn } from ".";
import { AppConstants } from "@/lib/utils/constants";

export const useLoginMutation = () => {
  return useMutation({
    mutationFn: (data: LoginIn) => authApi.login(data),
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
