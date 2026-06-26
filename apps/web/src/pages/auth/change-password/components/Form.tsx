import { AddonInput as Input } from "@/components/custom/addon-input";
import { FormField } from "@/components/custom/form-field";
import PasswordStrengthInput from "@/components/custom/password-strength";
import { Button } from "@/components/custom/stateful-button";
import { FieldGroup } from "@/components/ui/field";
import { Route } from "@/routes/auth/change-password";
import {
  ChangePasswordSchema,
  LoginInSchema,
  SignUpSchema,
  useChangePasswordMutation,
  useSignupMutation,
  type ChangePasswordIn,
  type SignUpIn,
} from "@/services/auth";
import { formOptions, useForm } from "@tanstack/react-form";
import { useNavigate, useSearch } from "@tanstack/react-router";
import React from "react";
import { toast } from "sonner";
import { z } from "zod";
const defaultValue: Pick<ChangePasswordIn, "email" | "password" | "rePassword"> = {
  email: "",
  password: "",
  rePassword: "",
};

const formOpts = formOptions({
  defaultValues: defaultValue,
  validators: {
    onSubmit: SignUpSchema,
  },
});
const ChangePasswordForm: React.FC = () => {
  const { selector } = useSearch({
    from: Route.id,
  });
  const { mutate, status } = useChangePasswordMutation();
  const navigate = useNavigate();
  const form = useForm({
    ...formOpts,
    onSubmit: (form) => {
      mutate(
        {
          password: z.string().parse(form.value.password),
          selector: z.string().parse(selector),
        },
        {
          onSuccess: async () => {
            await navigate({
              to: "/auth/login",
            });
          },
        },
      ); // use login schema as the submission source
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
        <FormField form={form} name="password" label="Password">
          {({ inputProps }) => (
            <PasswordStrengthInput
              mutationState={status}
              isPassword
              placeholder="Password"
              {...inputProps}
            />
          )}
        </FormField>
        <FormField form={form} name="rePassword" label="Re-Enter Password">
          {({ inputProps }) => (
            <Input mutationState={status} isPassword placeholder="Password" {...inputProps} />
          )}
        </FormField>
      </FieldGroup>
      <Button
        onClick={form.handleSubmit}
        className="mt-4 w-full py-2 font-medium"
        disabled={status === "pending"}
      >
        Sign up
      </Button>
    </form>
  );
};

export default ChangePasswordForm;
