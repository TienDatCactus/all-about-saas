import * as z from "zod";
import { validationMessages } from "./message";

export const LoginInSchema = z // all zod types gonna called schema
  .object({
    email: z.email({
      message: validationMessages.email.invalid,
    }),
    password: z
      .string()
      .min(6, {
        message: validationMessages.password.min,
      })
      .max(50, {
        message: validationMessages.password.max,
      }),
  })
  .required();

export type LoginIn = z.infer<typeof LoginInSchema>;
