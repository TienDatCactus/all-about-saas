import * as z from "zod";
import { validationMessages } from "./message";
import { mixValues } from "motion";

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

export const SignUpSchema = z
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
    rePassword: z.string(),
  })
  .refine(
    (val) => {
      return val.password == val.rePassword;
    },
    {
      message: validationMessages.rePassword.notMatch,
      path: ["rePassword"],
    },
  )
  .required();

export type SignUpIn = z.infer<typeof SignUpSchema>;

export const VerifyEmailSchema = z.object({
  token: z.string(),
  selector: z.string(),
  type: z.enum(["EMAIL_VERIFY", "PASSWORD_RESET"]),
});

export type VerifyEmailIn = z.infer<typeof VerifyEmailSchema>;

export const SendVerificationEmailSchema = z.object({
  email: z.email().optional(),
  selector: z.string().optional(),
  type: z.enum(["EMAIL_VERIFY", "PASSWORD_RESET"]),
});

export type SendVerificationEmailIn = z.infer<
  typeof SendVerificationEmailSchema
>;

export const ChangePasswordSchema = z.object({
  type: SendVerificationEmailSchema.shape.type,
  selector: SendVerificationEmailSchema.shape.selector,
  token: VerifyEmailSchema.shape.token,
  password: SignUpSchema.shape.password,
  rePassword: SignUpSchema.shape.rePassword,
});
