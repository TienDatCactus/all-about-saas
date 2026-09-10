import { formOptions, useForm } from "@tanstack/react-form"
import { useNavigate } from "@tanstack/react-router"
import React from "react"
import { useTranslation } from "react-i18next"
import type { SignUpIn } from "@/services/auth"
import { AddonInput as Input } from "@/components/custom/addon-input"
import { FormField } from "@/components/custom/form-field"
import PasswordStrengthInput from "@/components/custom/password-strength"
import { Button } from "@/components/custom/stateful-button"
import { FieldGroup } from "@/components/ui/field"
import { LoginInSchema, SignUpSchema, useSignupMutation } from "@/services/auth"
import { toast } from "@/components/custom/toast"

const defaultValue: SignUpIn = { email: "", password: "", rePassword: "" }

const formOpts = formOptions({
  defaultValues: defaultValue,
  validators: {
    onSubmit: SignUpSchema,
  },
})
const SignUpForm: React.FC = () => {
  const { t } = useTranslation()
  const { mutate, status } = useSignupMutation()
  const navigate = useNavigate()
  const form = useForm({
    ...formOpts,
    onSubmit: (submission) => {
      mutate(LoginInSchema.parse(submission.value), {
        onSuccess: () => {
          toast.success(t("auth.signUp.checkInbox"), {
            description: t("auth.signUp.activationEmailSent"),
          })
          // Fire-and-forget: nothing to do after the redirect settles.
          void navigate({
            to: "/auth/login",
          })
        },
      }) // use login schema as the submission source
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
      className="space-y-4"
    >
      <FieldGroup>
        <FormField form={form} name="email" label={t("auth.login.email")}>
          {({ inputProps }) => (
            <Input
              mutationState={status}
              placeholder={t("auth.login.email")}
              {...inputProps}
            />
          )}
        </FormField>

        <FormField
          form={form}
          name="password"
          label={t("auth.login.password")}
          showError={false}
        >
          {({ inputProps }) => (
            <PasswordStrengthInput
              mutationState={status}
              isPassword
              placeholder={t("auth.login.password")}
              {...inputProps}
            />
          )}
        </FormField>
        <FormField
          form={form}
          name="rePassword"
          label={t("auth.signUp.rePassword")}
        >
          {({ inputProps }) => (
            <Input
              mutationState={status}
              isPassword
              placeholder={t("auth.login.password")}
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
        {t("auth.signUp.submit")}
      </Button>
    </form>
  )
}

export default SignUpForm
