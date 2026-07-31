import * as z from "zod"
import { validationMessages } from "./message"

/**
 * The one place the password policy lives, for every form that *chooses* a
 * password. Bounds mirror PASSWORD_MIN_LENGTH / PASSWORD_MAX_LENGTH in the API
 * (apps/api/src/auth/dto/password.constraints.ts): a client minimum below the
 * server's turns a helpful inline hint into a 400 after submit.
 */
export const PasswordSchema = z
  .string()
  .min(8, {
    error: validationMessages.password.min,
  })
  .max(72, {
    error: validationMessages.password.max,
  })
  .regex(/[A-Z]/, {
    error: validationMessages.password.containsUppercase,
  })
  .regex(/[!@#$%^&*(),.?":{}|<>]/, {
    error: validationMessages.password.containsSpecial,
  })

export const LoginInSchema = z // all zod types gonna called schema
  .object({
    email: z.email({
      error: validationMessages.email.invalid,
    }),
    /**
     * Deliberately not PasswordSchema. A login form receives an existing
     * password, so composition rules here only ever do harm: they lock out an
     * account created under an older policy, and they publish the policy to
     * anyone who opens the page. The server decides; this field just has to be
     * non-empty.
     */
    password: z.string().min(1, {
      error: validationMessages.password.required,
    }),
  })
  .required()

export type LoginIn = z.infer<typeof LoginInSchema>

export const SignUpSchema = z
  .object({
    email: z.email({
      error: validationMessages.email.invalid,
    }),
    password: PasswordSchema,
    rePassword: z.string(),
  })
  .refine(
    (val) => {
      return val.password == val.rePassword
    },
    {
      message: validationMessages.rePassword.notMatch,
      path: ["rePassword"],
    }
  )
  .required()

export type SignUpIn = z.infer<typeof SignUpSchema>

export const VerifyEmailSchema = z.object({
  token: z.string(),
  selector: z.string(),
  type: z.enum(["EMAIL_VERIFY", "PASSWORD_RESET"]),
})

export type VerifyEmailIn = z.infer<typeof VerifyEmailSchema>

export const SendVerificationEmailSchema = z.object({
  email: z.email().optional(),
  selector: z.string().optional(),
  type: z.enum(["EMAIL_VERIFY", "PASSWORD_RESET"]),
})

export type SendVerificationEmailIn = z.infer<
  typeof SendVerificationEmailSchema
>

/**
 * Completing a forgotten-password reset: the emailed selector + token are the
 * proof of identity, so there is no current password to give.
 *
 * Split from ChangePasswordSchema below, mirroring the same split on the API. The
 * single shared schema carried `email` alongside `selector`/`token`, which made it
 * impossible to tell from a call site which flow was being used.
 */
export const ResetPasswordSchema = z.object({
  type: SendVerificationEmailSchema.shape.type,
  selector: SendVerificationEmailSchema.shape.selector,
  token: VerifyEmailSchema.shape.token,
  email: SendVerificationEmailSchema.shape.email,
  password: PasswordSchema,
  rePassword: z.string(),
})

export type ResetPasswordIn = z.infer<typeof ResetPasswordSchema>

/**
 * The signed-in user changing their own password. `currentPassword` is required
 * by the API — an access token alone is not proof of ownership when it lives in
 * localStorage.
 */
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, {
    error: validationMessages.password.required,
  }),
  newPassword: PasswordSchema,
  rePassword: z.string(),
})

export type ChangePasswordIn = z.infer<typeof ChangePasswordSchema>
