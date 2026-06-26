import Logo from "@/components/custom/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import React from "react";
import SignUpForm from "./components/Form";
const ChangePassword: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="flex flex-1 flex-col justify-center px-4 py-10 lg:px-6">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <div>
            <Logo alt="Logo" className="w-52 mx-auto" />
          </div>
          <h2 className="text-center text-xl font-semibold text-balance text-foreground">
            Change your password
          </h2>{" "}
          <p className="mt-4 text-xs text-pretty text-center text-muted-foreground dark:text-muted-foreground">
            By changing your password, you agree to our{" "}
            <a href="#" className="underline underline-offset-4">
              terms of service
            </a>{" "}
            and{" "}
            <a href="#" className="underline underline-offset-4">
              privacy policy
            </a>
            .
          </p>
          <SignUpForm />
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              navigate({
                to: "/auth/login",
              })
            }
            className="w-full "
          >
            <ArrowLeftIcon />
            Back to Login
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
