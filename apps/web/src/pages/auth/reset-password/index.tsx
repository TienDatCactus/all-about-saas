import Logo from "@/components/custom/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import React from "react";
import ForgotPasswordForm from "./components/Form";
const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="flex flex-1 flex-col justify-center px-4 py-10 lg:px-6">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <div>
            <Logo alt="Logo" className="w-52 mx-auto" />
          </div>
          <h2 className="text-center text-xl font-semibold text-balance text-foreground">
            Reset Password
          </h2>{" "}
          <p className="mt-4 text-xs text-pretty text-center text-muted-foreground dark:text-muted-foreground">
            Enter your email address and we'll send you a link to reset your
            password.
          </p>
          <ForgotPasswordForm />
          <div className="relative my-6">
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
            variant="outline"
            onClick={() =>
              navigate({
                to: "/auth/login",
              })
            }
            className="flex w-full items-center justify-center space-x-2 py-2"
          >
            <ArrowLeftIcon />
            <span className="text-sm font-medium">Back to Login</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
