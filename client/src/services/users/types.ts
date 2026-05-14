import * as z from "zod"
import { validationMessages } from "./message"
export const LoginIn = z
  .object({
    email: z.email({
      error: validationMessages.email.invalid,
    }),
    password: z
      .string()
      .min(6, {
        error: validationMessages.password.min,
      })
      .max(20, {
        error: validationMessages.password.max,
      }),
  })
  .required()
