// addon-input.tsx
import * as React from "react"
import { cn } from "@/lib/utils"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../ui/input-group"
import { CheckIcon } from "../ui/check"
import { BadgeAlertIcon } from "../ui/badge-alert"
import type { MutationStatus } from "@tanstack/react-query"
import { Spinner } from "../ui/spinner"
import { EyeIcon } from "../ui/eye"
import { EyeOffIcon } from "../ui/eye-off"

export interface InputProps extends Omit<
  React.ComponentProps<"input">,
  "state"
> {
  mutationState?: MutationStatus
  startAddon?: React.ReactNode
  endAddon?: React.ReactNode
  containerClassName?: string
  isPassword?: boolean
}

const AddonInput = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      mutationState,
      startAddon,
      endAddon,
      containerClassName,
      isPassword,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = React.useState(false)
    const disabled =
      props.value === "" || props.value === undefined || props.disabled

    const stateClasses: Record<MutationStatus, string> = {
      idle: "",
      pending:
        "border-yellow-500 focus-within:border-yellow-500 focus-within:ring-3 focus-within:ring-yellow-500/20 dark:focus-within:ring-yellow-500/40",
      success:
        "border-emerald-500 focus-within:border-emerald-500 focus-within:ring-3 focus-within:ring-emerald-500/20 dark:focus-within:ring-emerald-500/40",
      error:
        "border-destructive focus-within:border-destructive focus-within:ring-3 focus-within:ring-destructive/20 dark:focus-within:ring-destructive/40",
    }

    const renderEndAddon = () => {
      if (isPassword) {
        return (
          <>
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="button"
                variant="ghost"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={disabled}
              >
                {showPassword && !disabled ? (
                  <EyeIcon size={18} aria-hidden="true" />
                ) : (
                  <EyeOffIcon size={18} aria-hidden="true" />
                )}
              </InputGroupButton>
            </InputGroupAddon>
            <span className="sr-only">
              {showPassword ? "Hide password" : "Show password"}
            </span>
          </>
        )
      }

      if (endAddon) {
        return <InputGroupAddon align="inline-end">{endAddon}</InputGroupAddon>
      }

      switch (mutationState) {
        case "pending":
          return (
            <InputGroupAddon align="inline-end">
              <Spinner className="text-muted-foreground" />
            </InputGroupAddon>
          )
        case "success":
          return (
            <InputGroupAddon align="inline-end">
              <CheckIcon size={18} className="text-emerald-500" />
            </InputGroupAddon>
          )
        case "error":
          return (
            <InputGroupAddon align="inline-end">
              <BadgeAlertIcon size={18} className="text-destructive" />
            </InputGroupAddon>
          )
        default:
          return null
      }
    }

    return (
      <>
        <InputGroup
          className={cn(
            mutationState && stateClasses[mutationState],
            containerClassName
          )}
          data-state={mutationState}
          data-disabled={props.disabled}
        >
          {startAddon && (
            <InputGroupAddon align="inline-start">{startAddon}</InputGroupAddon>
          )}

          <InputGroupInput
            type={
              isPassword ? (showPassword ? "text" : "password") : type || "text"
            }
            className={cn(isPassword && "hide-password-toggle", className)}
            ref={ref}
            aria-invalid={mutationState === "error" ? "true" : undefined}
            {...props}
          />

          {renderEndAddon()}
        </InputGroup>

        {isPassword && (
          <style>{`
            .hide-password-toggle::-ms-reveal,
            .hide-password-toggle::-ms-clear {
              visibility: hidden;
              pointer-events: none;
              display: none;
            }
          `}</style>
        )}
      </>
    )
  }
)
AddonInput.displayName = "AddonInput"

export { AddonInput }
