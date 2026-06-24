import Logo from "@/components/custom/logo";
import { Button } from "@/components/ui/button";
import {
  useResendVerificationEmailMutation,
  useVerifyEmailMutation,
  VerifyEmailSchema,
} from "@/services/auth";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { cn } from "../lib/utils";
import {
  CheckCircleIcon,
  XCircleIcon,
  EnvelopeOpenIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";

export const Route = createFileRoute("/verify-email")({
  component: RouteComponent,
  validateSearch: VerifyEmailSchema,
});

function RouteComponent() {
  const { selector, token } = Route.useSearch();
  const { mutate, status } = useVerifyEmailMutation();
  const { mutate: resendEmail, status: resendStatus } =
    useResendVerificationEmailMutation();

  useEffect(() => {
    if (selector && token) {
      mutate({
        selector,
        token,
      });
    }
  }, [selector, token]);

  const onResendEmail = () => {
    if (selector) {
      resendEmail(selector, {
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
      });
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
          <div className="w-full space-y-3 mt-4">
            <Button
              className="w-full"
              disabled={isPending}
              onClick={onResendEmail}
            >
              {isPending ? "Resending..." : "Resend Verification Email"}
            </Button>
            <Button className="w-full" variant="outline" asChild>
              <Link to="/auth/login">Back to Login</Link>
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
              })
            }
          >
            {isPending ? "Verifying..." : "Verify Email"}
          </Button>
          <p className="text-sm">
            Didn't receive the email?{" "}
            <a
              className={cn(
                "link font-medium cursor-pointer",
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
