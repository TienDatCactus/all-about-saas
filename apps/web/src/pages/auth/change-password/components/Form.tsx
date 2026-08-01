import { useForm } from "@tanstack/react-form"
import { useNavigate, useSearch } from "@tanstack/react-router"
import React from "react"
import { z } from "zod"
import { AddonInput as Input } from "@/components/custom/addon-input"
import { FormField } from "@/components/custom/form-field"
import { Button } from "@/components/custom/stateful-button"
import { FieldGroup } from "@/components/ui/field"
import { ResetPasswordSchema, useResetPasswordMutation } from "@/services/auth"
import { toast } from "@/components/custom/toast"

const ChangePasswordForm: React.FC = () => {
  const navigate = useNavigate()
  const { selector, token } = useSearch({ from: "/auth/change-password" })
  // This page is reached from the emailed reset link, so it completes a reset
  // even though its route is still /auth/change-password.
  const { mutate, status } = useResetPasswordMutation()

  const form = useForm({
    defaultValues: {
      password: "",
      rePassword: "",
    },
    validators: {
      onSubmit: z
        .object({
          password: ResetPasswordSchema.shape.password,
          rePassword: ResetPasswordSchema.shape.rePassword,
        })
        .refine((val) => val.password === val.rePassword, {
          message: "Passwords do not match",
          path: ["rePassword"],
        }),
    },
    onSubmit: (submission) => {
      mutate(
        {
          selector,
          token,
          password: submission.value.password,
        },
        {
          onSuccess: () => {
            toast.success("Password changed successfully! You can now log in.")
            // Fire-and-forget: nothing to do after the redirect settles.
            void navigate({
              to: "/auth/login",
            })
          },
          onError: (err: any) => {
            const message =
              err?.response?.data?.message ||
              err?.message ||
              "Failed to change password."
            toast.error(message)
          },
        }
      )
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        // onSubmit only calls the (sync, fire-and-forget) mutate, so this
        // promise cannot reject — outcomes surface through mutation status.
        void form.handleSubmit()
      }}
      method="post"
      className="mt-6 space-y-4"
    >
      <FieldGroup>
        <FormField form={form} name="password" label="New Password">
          {({ inputProps }) => (
            <Input
              mutationState={status}
              isPassword
              placeholder="New Password"
              {...inputProps}
            />
          )}
        </FormField>
        <FormField form={form} name="rePassword" label="Confirm Password">
          {({ inputProps }) => (
            <Input
              mutationState={status}
              isPassword
              placeholder="Confirm Password"
              {...inputProps}
            />
          )}
        </FormField>
      </FieldGroup>
      <Button
        onClick={form.handleSubmit}
        className="mt-4 w-full py-2 font-medium"
        mutationState={status}
      >
        Reset Password
      </Button>
    </form>
  )
}

export default ChangePasswordForm
