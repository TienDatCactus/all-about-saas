import Logo from "@/components/custom/logo";
import { Button } from "@/components/ui/button";
import {
  useResendVerificationEmailMutation,
  useVerifyEmailMutation,
  VerifyEmailSchema,
} from "@/services/auth";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
export const Route = createFileRoute("/verify-email")({
  component: RouteComponent,
  validateSearch: VerifyEmailSchema,
});

function RouteComponent() {
  const { selector, token } = Route.useSearch();
  const { mutate } = useVerifyEmailMutation();
  const { mutate: resendEmail } = useResendVerificationEmailMutation();
  useEffect(() => {
    if (selector && token) {
      mutate({
        selector,
        token,
      });
    }
  }, [selector, token]);

  const onResendEmail = () => {
    resendEmail(selector);
  };
  return (
    <div className="flex flex-col justify-center items-center text-center max-w-96">
      <div>
        <Logo alt="Logo" className="w-52 mx-auto" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Confirming your email</h1>
        <p className="text-secondary-foreground text-sm">
          We sent you a confirmation link. Click on it to verify your account
          and get started.
        </p>
        <Button
          className="w-full my-2"
          onClick={() =>
            mutate({
              selector,
              token,
            })
          }
        >
          Verify Email
        </Button>
        <p className="text-sm ">
          Didn't receive the email?{" "}
          <Button variant="link" onClick={onResendEmail}>
            Resend email
          </Button>
        </p>
      </div>
    </div>
  );
}
