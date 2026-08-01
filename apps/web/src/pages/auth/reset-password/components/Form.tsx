import { formOptions, useForm } from "@tanstack/react-form"
import React from "react"
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
            toast.success("Check your inbox", {
              description: "We have sent you an activation email",
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
          label="Email"
          description="Enter your email address and we'll send you a link to reset your
            password."
        >
          {({ inputProps }) => (
            <Input mutationState={status} placeholder="Email" {...inputProps} />
          )}
        </FormField>
      </FieldGroup>
      <Button
        onClick={form.handleSubmit}
        className="mt-4 w-full py-2 font-medium"
        disabled={status === "pending"}
      >
        Confirm
      </Button>
    </form>
  )
}

export default ForgotPasswordForm
