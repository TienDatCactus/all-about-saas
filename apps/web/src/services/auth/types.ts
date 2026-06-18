import * as z from "zod";
import { validationMessages } from "./message";

export const LoginInSchema = z // all zod types gonna called schema
  .object({
    email: z.email({
      error: validationMessages.email.invalid,
    }),
    password: z
      .string()
      .min(6, {
        error: validationMessages.password.min,
      })
      .max(50, {
        error: validationMessages.password.max,
      })
      .regex(/[A-Z]/, {
        error: validationMessages.password.containsUppercase,
      })
      .regex(/[!@#$%^&*(),.?":{}|<>]/, {
        error: validationMessages.password.containsSpecial,
      }),
  })
  .required();

export type LoginIn = z.infer<typeof LoginInSchema>;
