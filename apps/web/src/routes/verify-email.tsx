import { ArrowLeftIcon } from "@phosphor-icons/react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"
import { cn } from "../lib/utils"
import Logo from "@/components/custom/logo"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  VerifyEmailSchema,
  useSendVerificationEmailMutation,
  useVerifyEmailMutation,
} from "@/services/auth"
import { toast } from "@/components/custom/toast"

export const Route = createFileRoute("/verify-email")({
  component: RouteComponent,
  validateSearch: VerifyEmailSchema,
})

function RouteComponent() {
  const navigate = Route.useNavigate()
  const { selector, token, type } = Route.useSearch()
  const { mutate, status } = useVerifyEmailMutation()
  const { mutate: resendEmail, status: resendStatus } =
    useSendVerificationEmailMutation()

  useEffect(() => {
    if (selector && token && status === "idle") {
      mutate(
        {
          selector,
          token,
          type,
        },
        {
          onSuccess: (_, variables) => {
            if (type === "PASSWORD_RESET") {
              // mutate-level callbacks are fire-and-forget in react-query (the
              // returned promise was never awaited), so don't pretend to await.
              void navigate({
                to: "/auth/change-password",
                search: {
                  selector: variables.selector,
                  token: variables.token,
                  type: type,
                },
              })
            }
          },
        }
      )
    }
  }, [selector, token, status, type, mutate, navigate])

  const onResendEmail = () => {
    if (selector) {
      resendEmail(
        { selector, type },
        {
          onSuccess: () => {
            toast.success(
              type === "PASSWORD_RESET"
                ? "Password reset email resent successfully!"
                : "Verification email resent successfully!"
            )
          },
          onError: (err: any) => {
            const message =
              err?.response?.data?.message ||
              err?.message ||
              "Failed to resend email."
            toast.error(message)
          },
        }
      )
    }
  }

  const isPending = status === "pending" || resendStatus === "pending"
  const isError = status === "error" || resendStatus === "error"
  const isReset = type === "PASSWORD_RESET"

  const confirmTitle = isPending
    ? isReset
      ? "Confirming reset request..."
      : "Verifying your email..."
    : isReset
      ? "Confirm password reset"
      : "Confirm your email"

  const confirmDescription = isReset
    ? "We are confirming your password reset request. This will only take a moment."
    : "We are confirming your email address. This will only take a moment."

  const verifyButtonText = isPending
    ? "Verifying..."
    : isReset
      ? "Verify Reset Request"
      : "Verify Email"

  const errorTitle = isReset ? "Reset link invalid" : "Verification failed"
  const errorDescription = isReset
    ? "The reset link is invalid, has expired, or has already been used. Please request a new reset email below."
    : "The verification link is invalid, has expired, or has already been used. Please request a new verification email below."

  const resendButtonText = isPending
    ? "Resending..."
    : isReset
      ? "Resend Reset Email"
      : "Resend Verification Email"

  return (
    <div className="flex max-w-96 flex-col items-center justify-center space-y-6 text-center">
      <div className="mb-2">
        <Logo alt="Logo" className="mx-auto w-32" />
      </div>

      {status === "success" ? (
        <div className="flex flex-col items-center space-y-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Email verified!
            </h1>
            <p className="text-sm text-secondary-foreground">
              Thank you for verifying your email. Your account is active and you
              are ready to get started.
            </p>
          </div>
          <Button className="mt-4 w-full" asChild>
            <Link to="/auth/login">Continue to Login</Link>
          </Button>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center space-y-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">{errorTitle}</h1>
            <p className="text-sm text-secondary-foreground">
              {errorDescription}
            </p>
          </div>
          <div className="w-full">
            <Button
              className="w-full"
              disabled={isPending}
              onClick={onResendEmail}
            >
              {resendButtonText}
            </Button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  or
                </span>
              </div>
            </div>
            <Button
              onClick={() => {
                void navigate({
                  to: "/auth/login",
                })
              }}
              className="w-full"
              variant="outline"
            >
              <ArrowLeftIcon />
              Back to Login
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {confirmTitle}
            </h1>
            <p className="text-sm text-secondary-foreground">
              {confirmDescription}
            </p>
          </div>
          <Button
            className="mt-4 w-full"
            disabled={isPending}
            onClick={() =>
              mutate({
                selector,
                token,
                type,
              })
            }
          >
            {verifyButtonText}
          </Button>
          <p className="text-sm">
            Didn't receive the email?{" "}
            <Button
              variant="link"
              className={cn(
                "link text-primary",
                isPending && "pointer-events-none opacity-50"
              )}
              onClick={onResendEmail}
              role="button"
            >
              Resend email
            </Button>
          </p>
        </div>
      )}
    </div>
  )
}
