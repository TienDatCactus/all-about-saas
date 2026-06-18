import { z, ZodError } from "zod";
import { AddonInput as Input, type InputProps } from "./addon-input";
import { LoginInSchema } from "@/services/auth";
import React, { useMemo, useState } from "react";
import { Badge } from "../ui/badge";
import { li } from "motion/react-client";
import { validationMessages } from "@/services/auth/message";
import { Item, ItemGroup, ItemSeparator } from "../ui/item";
import DataItem from "./data/item";
import { CheckCircleIcon, XCircleIcon } from "@phosphor-icons/react";
import { FieldDescription } from "../ui/field";
import { Progress } from "../ui/progress";
import { cn } from "@/lib/utils";

interface PasswordStrengthProps extends InputProps {}
const PasswordStrengthSchema = LoginInSchema.pick({
  password: true,
});
const checks = [
  validationMessages.password.min,
  validationMessages.password.containsUppercase,
  validationMessages.password.containsSpecial,
  validationMessages.password.max,
  validationMessages.password.invalid,
];
export default function PasswordStrengthInput(props: PasswordStrengthProps) {
  const password = typeof props.value === "string" ? props.value : "";
  const result = useMemo(() => {
    return PasswordStrengthSchema.safeParse({
      password,
    });
  }, [password]);
  const errors = result.success
    ? []
    : result.error.issues.map((issue) => issue.message);
  const passed = checks.length - errors.length;
  function getStrengthVariant(passedChecks: number) {
    if (passedChecks <= 2) {
      return "danger";
    }

    if (passedChecks <= 4) {
      return "warning";
    }

    return "success";
  }
  const score = (passed / checks.length) * 100;
  return (
    <div className="flex flex-col gap-2">
      <Input {...props} isPassword />
      <Progress
        className="*:rounded-none my-2"
        appearance="dashed"
        variant={getStrengthVariant(passed)}
        value={score}
        segments={checks.length}
      />
      <div>
        <ItemGroup className="gap-0">
          {!!checks &&
            checks.length > 0 &&
            checks.map((i, index) => (
              <DataItem
                className={cn(
                  "p-1",
                  index == 0 && "pt-0",
                  !errors?.includes(i) ? "text-success" : "text-destructive",
                )}
                title={i}
                key={index}
                media={{
                  icon: errors?.includes(i) ? (
                    <XCircleIcon className="text-destructive" size={32} />
                  ) : (
                    <CheckCircleIcon className="text-success" size={32} />
                  ),
                  variant: "icon",
                }}
              />
            ))}
        </ItemGroup>
      </div>
    </div>
  );
}
