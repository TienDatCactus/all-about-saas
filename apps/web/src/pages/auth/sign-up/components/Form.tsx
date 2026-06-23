import { AddonInput as Input } from "@/components/custom/addon-input";
import { FormField } from "@/components/custom/form-field";
import PasswordStrengthInput from "@/components/custom/password-strength";
import { Button } from "@/components/custom/stateful-button";
import { FieldGroup } from "@/components/ui/field";
import { SignUpSchema, useSignupMutation, type LoginIn } from "@/services/auth";
import { formOptions, useForm } from "@tanstack/react-form";
import React from "react";
const defaultValue: LoginIn = { email: "", password: "" };

const formOpts = formOptions({
  defaultValues: defaultValue,
  validators: {
    onSubmit: SignUpSchema,
  },
});
const SignUpForm: React.FC = () => {
  const { mutate, status } = useSignupMutation();
  const form = useForm({
    ...formOpts,
    onSubmit: (form) => {
      mutate(
        SignUpSchema.pick({
          email: true,
          password: true,
        }).parse(form.value),
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
            <Input
              mutationState={status}
              isPassword
              placeholder="Password"
              {...inputProps}
            />
          )}
        </FormField>
      </FieldGroup>
      <Button
        onClick={form.handleSubmit}
        className="mt-4 w-full py-2 font-medium"
      >
        Sign in
      </Button>
    </form>
  );
};

export default SignUpForm;
