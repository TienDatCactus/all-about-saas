import { formOptions, useForm } from "@tanstack/react-form"
import { useNavigate } from "@tanstack/react-router"
import type { NavigateOptions } from "@tanstack/react-router"
import React from "react"
import { useTranslation } from "react-i18next"
import type { LoginIn } from "@/services/auth"
import { AddonInput as Input } from "@/components/custom/addon-input"
import { FormField } from "@/components/custom/form-field"
import { Button } from "@/components/custom/stateful-button"
import { FieldGroup } from "@/components/ui/field"
import { LoginInSchema, useLoginMutation } from "@/services/auth"

const defaultValue: LoginIn = { email: "", password: "" }

const formOpts = formOptions({
  defaultValues: defaultValue,
  validators: {
    onSubmit: LoginInSchema,
  },
})
interface LoginFormProps {
  redirectTo?: NavigateOptions["to"] | null
}

const LoginForm: React.FC<LoginFormProps> = ({ redirectTo = "/" }) => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { mutate, status } = useLoginMutation()
  const form = useForm({
    ...formOpts,
    onSubmit: (submission) => {
      mutate(LoginInSchema.parse(submission.value), {
        onSuccess: () => {
          if (redirectTo === null) return
          // Fire-and-forget: nothing to do after the redirect settles.
          void navigate({
            to: redirectTo,
          })
        },
      })
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
        <FormField form={form} name="password" label={t("auth.login.password")}>
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
        mutationState={status}
      >
        {t("auth.login.submit")}
      </Button>
    </form>
  )
}

export default LoginForm
