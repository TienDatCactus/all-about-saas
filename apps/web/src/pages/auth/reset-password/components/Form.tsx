import { formOptions, useForm } from "@tanstack/react-form"
import React from "react"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { AddonInput as Input } from "@/components/custom/addon-input"
import { FormField } from "@/components/custom/form-field"
import { Button } from "@/components/custom/stateful-button"
import { FieldGroup } from "@/components/ui/field"
import {
  LoginInSchema,
  useSendVerificationEmailMutation,
} from "@/services/auth"
import { toast } from "@/components/custom/toast"

const defaultValue = { email: "" }

const formOpts = formOptions({
  defaultValues: defaultValue,
  validators: {
    onSubmit: z.object({
      email: LoginInSchema.shape.email,
    }),
  },
})
const ForgotPasswordForm: React.FC = () => {
  const { t } = useTranslation()
  const { mutate, status } = useSendVerificationEmailMutation()

  const form = useForm({
    ...formOpts,
    onSubmit: (submission) => {
      mutate(
        {
          type: "PASSWORD_RESET",
          email: submission.value.email,
        },
        {
          onSuccess: () => {
            toast.success(t("auth.signUp.checkInbox"), {
              description: t("auth.signUp.activationEmailSent"),
            })
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
        <FormField
          form={form}
          name="email"
          label={t("auth.login.email")}
          description={t("auth.resetPassword.description")}
        >
          {({ inputProps }) => (
            <Input
              mutationState={status}
              placeholder={t("auth.login.email")}
              {...inputProps}
            />
          )}
        </FormField>
      </FieldGroup>
      <Button
        onClick={form.handleSubmit}
        className="mt-4 w-full py-2 font-medium"
        disabled={status === "pending"}
      >
        {t("auth.resetPassword.submit")}
      </Button>
    </form>
  )
}

export default ForgotPasswordForm
