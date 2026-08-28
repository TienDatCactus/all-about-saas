import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { paymentMethodsApi } from "./api"
import type { CreatePaymentMethodIn } from "./types"

export const paymentMethodKeys = {
  all: ["payment-methods"] as const,
}

export const usePaymentMethodsQuery = () => {
  return useQuery({
    queryKey: paymentMethodKeys.all,
    queryFn: () => paymentMethodsApi.list(),
  })
}

export const useCreatePaymentMethodMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePaymentMethodIn) => paymentMethodsApi.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all })
    },
  })
}

export const useDeletePaymentMethodMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => paymentMethodsApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all })
    },
  })
}
