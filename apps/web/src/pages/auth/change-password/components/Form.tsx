import { AddonInput as Input } from "@/components/custom/addon-input";
import { FormField } from "@/components/custom/form-field";
import { Button } from "@/components/custom/stateful-button";
import { FieldGroup } from "@/components/ui/field";
import { ChangePasswordSchema, useChangePasswordMutation } from "@/services/auth";
import { useForm } from "@tanstack/react-form";
import { useNavigate, useSearch } from "@tanstack/react-router";
import React from "react";
import { toast } from "@/components/custom/toast";
import { z } from "zod";

const ChangePasswordForm: React.FC = () => {
  const navigate = useNavigate();
  const { selector, token } = useSearch({ from: "/auth/change-password" });
  const { mutate, status } = useChangePasswordMutation();

  const form = useForm({
    defaultValues: {
      password: "",
      rePassword: "",
    },
    validators: {
      onSubmit: z
        .object({
          password: ChangePasswordSchema.shape.password,
          rePassword: ChangePasswordSchema.shape.rePassword,
        })
        .refine((val) => val.password === val.rePassword, {
          message: "Passwords do not match",
          path: ["rePassword"],
        }),
    },
    onSubmit: (form) => {
      mutate(
        {
          selector,
          token,
          password: form.value.password,
        },
        {
          onSuccess: () => {
            toast.success("Password changed successfully! You can now log in.");
            navigate({
              to: "/auth/login",
            });
          },
          onError: (err: any) => {
            const message =
              err?.response?.data?.message || err?.message || "Failed to change password.";
            toast.error(message);
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
  );
};

export default ChangePasswordForm;
