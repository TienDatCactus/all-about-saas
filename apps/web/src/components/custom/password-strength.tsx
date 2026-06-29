import { cn } from "@/lib/utils";
import { LoginInSchema } from "@/services/auth";
import { validationMessages } from "@/services/auth/message";
import {
  CheckCircleIcon,
  DotsThreeCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { useMemo } from "react";
import { ItemGroup } from "../ui/item";
import { Progress } from "../ui/progress";
import { AddonInput as Input, type InputProps } from "./addon-input";
import DataItem from "./data/item";

interface PasswordStrengthProps extends InputProps {}
const PasswordStrengthSchema = LoginInSchema.pick({
  password: true,
});
const checks = [
  validationMessages.password.min,
  validationMessages.password.max,
  validationMessages.password.containsUppercase,
  validationMessages.password.containsSpecial,
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
    if (passedChecks <= 1) {
      return "danger";
    }

    if (passedChecks <= 3) {
      return "warning";
    }

    return "success";
  }

  function getChecksIcon(errors: any, i: string) {
    if (!errors?.includes(i)) {
      return <CheckCircleIcon className="text-success" size={32} />;
    } else {
      return <XCircleIcon className="text-destructive" size={32} />;
    }
  }
  const score = props.value ? (passed / checks.length) * 100 : 0;
  return (
    <div className="flex flex-col gap-2">
      <Input {...props}  isPassword />
      <Progress
        className="*:rounded-none my-2 h-2"
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
                className={cn("p-1", index == 0 && "pt-0")}
                title={i}
                key={index}
                media={{
                  icon: props.value ? (
                    getChecksIcon(errors, i)
                  ) : (
                    <DotsThreeCircleIcon
                      className="text-accent-foreground"
                      size={32}
                    />
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
