import { AddonInput as Input } from "@/components/custom/addon-input";
import { FormField } from "@/components/custom/form-field";
import PasswordStrengthInput from "@/components/custom/password-strength";
import { Button } from "@/components/custom/stateful-button";
import { FieldGroup } from "@/components/ui/field";
import {
  LoginInSchema,
  SignUpSchema,
  useSignupMutation,
  type LoginIn,
  type SignUpIn,
} from "@/services/auth";
import { formOptions, useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import React from "react";
import { toast } from "sonner";
const defaultValue: SignUpIn = { email: "", password: "", rePassword: "" };

const formOpts = formOptions({
  defaultValues: defaultValue,
  validators: {
    onSubmit: SignUpSchema,
  },
});
const SignUpForm: React.FC = () => {
  const { mutate, status } = useSignupMutation();
  const navigate = useNavigate();
  const form = useForm({
    ...formOpts,
    onSubmit: (form) => {
      mutate(LoginInSchema.parse(form.value), {
        onSuccess: () => {
          toast.success("Check your inbox", {
            description: "We have sent you an activation email",
          });
          navigate({
            to: "/auth/login",
          });
        },
      }); // use login schema as the submission source
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
        disabled={status === "pending"}
      >
        Sign up
      </Button>
    </form>
  );
};

export default SignUpForm;
