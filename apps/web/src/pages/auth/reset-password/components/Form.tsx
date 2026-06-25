import { AddonInput as Input } from "@/components/custom/addon-input";
import { FormField } from "@/components/custom/form-field";
import { Button } from "@/components/custom/stateful-button";
import { FieldGroup } from "@/components/ui/field";
import {
  LoginInSchema,
  useSendVerificationEmailMutation,
  useSignupMutation,
} from "@/services/auth";
import { formOptions, useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import React from "react";
import { toast } from "sonner";
import { z } from "zod";
const defaultValue = { email: "" };

const formOpts = formOptions({
  defaultValues: defaultValue,
  validators: {
    onSubmit: z.object({
      email: LoginInSchema.shape.email,
    }),
  },
});
const ForgotPasswordForm: React.FC = () => {
  const { mutate, status } = useSendVerificationEmailMutation();
  const navigate = useNavigate();
  const form = useForm({
    ...formOpts,
    onSubmit: (form) => {
      mutate(
        {
          type: "PASSWORD_RESET",
          email: form.value.email,
        },
        {
          onSuccess: () => {
            toast.success("Check your inbox", {
              description: "We have sent you an activation email",
            });
            navigate({
              to: "/auth/login",
            });
          },
        },
      );
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      method="post"
      className="mt-6 space-y-4"
    >
      <FieldGroup>
        <FormField form={form} name="email" label="Email">
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
  );
};

export default ForgotPasswordForm;
