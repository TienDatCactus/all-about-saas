import { LoginIn } from "@/services/users/types"
import React from "react"
import type z from "zod"
import { useForm, formOptions } from "@tanstack/react-form"
import { FieldGroup } from "@/components/ui/field"
import { FormField } from "@/components/custom/form-field"
import { Input } from "@/components/ui/input"
import PasswordInput from "@/components/custom/password-input"
import { Button } from "@/components/custom/stateful-button"

const defaultValue: z.infer<typeof LoginIn> = { email: "", password: "" }

const formOpts = formOptions({
  defaultValues: defaultValue,
  onSubmit: (values) => {
    console.log(JSON.stringify(values))
  },
  validators: {
    onSubmit: LoginIn,
  },
})
const LoginForm: React.FC = () => {
  const form = useForm(formOpts)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      method="post"
      className="mt-6 space-y-4"
    >
      <FieldGroup>
        <FormField form={form} name="email" label="Email">
          {({ inputProps }) => <Input placeholder="Email" {...inputProps} />}
        </FormField>
        <FormField form={form} name="password" label="Password">
          {({ inputProps }) => (
            <PasswordInput placeholder="Password" {...inputProps} />
          )}
        </FormField>
      </FieldGroup>
      <Button type="submit" className="mt-4 w-full py-2 font-medium">
        Sign in
      </Button>
    </form>
  )
}

export default LoginForm
