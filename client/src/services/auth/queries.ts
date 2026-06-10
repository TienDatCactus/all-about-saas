import { storage } from "@/lib/utils/local-storage";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi, type LoginIn } from ".";
import { AppConstants } from "@/lib/utils/constants";

export const authKeys = {
  all: ["auth"] as const,
  profile: () => [...authKeys.all, "profile"] as const,
  list: () => [...authKeys.all, "list"] as const,
  detail: (id: number) => [...authKeys.all, "detail", id] as const,
};

export const useLoginMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LoginIn) => authApi.login(data),
    onSuccess: (res) => {
      storage.set(AppConstants.tokenKey, res);
      queryClient.invalidateQueries({ queryKey: authKeys.profile() });
    },
  });
};

export const useGoogleLoginMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.loginWithGoogle(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.profile() });
    },
  });
};

export const useLogoutMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      storage.remove(AppConstants.tokenKey);
      queryClient.invalidateQueries({ queryKey: authKeys.profile() });
    },
  });
};
