import { PAYMENT_METHODS } from "../url"
import {
  DeletedIdSchema,
  PaymentMethodSchema,
  type CreatePaymentMethodIn,
} from "./types"
import * as z from "zod"
import { parseResponse } from "@/lib/utils/parse-response"
import { http } from "@/lib/utils/http"

export const paymentMethodsApi = {
  list: () =>
    parseResponse(
      "paymentMethods.list",
      z.array(PaymentMethodSchema),
      http.get(PAYMENT_METHODS.list)
    ),
  create: (data: CreatePaymentMethodIn) => {
    const form = new FormData()
    form.append("type", data.type)
    form.append("label", data.label)
    if (data.phoneNumber) form.append("phoneNumber", data.phoneNumber)
    if (data.file) form.append("file", data.file)
    return parseResponse(
      "paymentMethods.create",
      PaymentMethodSchema,
      http.post(PAYMENT_METHODS.list, form)
    )
  },
  remove: (id: string) =>
    parseResponse(
      "paymentMethods.remove",
      DeletedIdSchema,
      http.delete(PAYMENT_METHODS.byId(id))
    ),
}
