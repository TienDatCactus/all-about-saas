import Logo from "@/components/custom/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  useSendVerificationEmailMutation,
  useVerifyEmailMutation,
  VerifyEmailSchema,
} from "@/services/auth";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { cn } from "../lib/utils";

export const Route = createFileRoute("/verify-email")({
  component: RouteComponent,
  validateSearch: VerifyEmailSchema,
});

function RouteComponent() {
  const navigate = Route.useNavigate();
  const { selector, token, type } = Route.useSearch();
  const { mutate, status } = useVerifyEmailMutation();
  const { mutate: resendEmail, status: resendStatus } =
    useSendVerificationEmailMutation();

  useEffect(() => {
    if (selector && token) {
      mutate(
        {
          selector,
          token,
          type,
        },
        {
          onSuccess: (_, variables) => {
            if (type === "EMAIL_VERIFY") {
              toast.success("Email verified successfully! You can now log in.");
            } else if (type === "PASSWORD_RESET") {
              toast.success(
                "Password reset email verified successfully! You can now reset your password.",
              );
              navigate({
                to: "/auth/change-password",
                search: {
                  selector: variables.selector,
                  token: variables.token,
                  type: type,
                },
              });
            }
          },
        },
      );
    }
  }, [selector, token, type]);

  const onResendEmail = () => {
    if (selector) {
      resendEmail(
        { selector, type },
        {
          onSuccess: () => {
            toast.success(
              "Verification email resent successfully! Please check your inbox.",
            );
          },
          onError: (err: any) => {
            const message =
              err?.response?.data?.message ||
              err?.message ||
              "Failed to resend verification email.";
            toast.error(message);
          },
        },
      );
    }
  };

  const isPending = status === "pending" || resendStatus === "pending";
  const isError = status === "error" || resendStatus === "error";

  return (
    <div className="flex flex-col justify-center items-center text-center max-w-96 space-y-6">
      <div className="mb-2">
        <Logo alt="Logo" className="w-32 mx-auto" />
      </div>

      {status === "success" ? (
        <div className="space-y-4 flex flex-col items-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Email verified!
            </h1>
            <p className="text-secondary-foreground text-sm">
              Thank you for verifying your email. Your account is active and you
              are ready to get started.
            </p>
          </div>
          <Button className="w-full mt-4" asChild>
            <Link to="/auth/login">Continue to Login</Link>
          </Button>
        </div>
      ) : isError ? (
        <div className="space-y-4 flex flex-col items-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Verification failed
            </h1>
            <p className="text-secondary-foreground text-sm">
              The verification link is invalid, has expired, or has already been
              used. Please request a new verification email below.
            </p>
          </div>
          <div className="w-full">
            <Button
              className="w-full"
              disabled={isPending}
              onClick={onResendEmail}
            >
              {isPending ? "Resending..." : "Resend Verification Email"}
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
            <Button className="w-full" variant="outline">
              <ArrowLeftIcon />
              Back to Login
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 flex flex-col items-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {isPending ? "Verifying your email..." : "Confirm your email"}
            </h1>
            <p className="text-secondary-foreground text-sm">
              We are confirming your email address. This will only take a
              moment.
            </p>
          </div>
          <Button
            className="w-full mt-4"
            disabled={isPending}
            onClick={() =>
              mutate({
                selector,
                token,
                type,
              })
            }
          >
            {isPending ? "Verifying..." : "Verify Email"}
          </Button>
          <p className="text-sm">
            Didn't receive the email?{" "}
            <a
              className={cn(
                "link text-primary",
                isPending && "pointer-events-none opacity-50",
              )}
              onClick={onResendEmail}
            >
              Resend email
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
