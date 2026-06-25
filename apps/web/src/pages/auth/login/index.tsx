import Logo from "@/components/custom/logo";
import { Separator } from "@/components/ui/separator";
import { Link } from "@tanstack/react-router";
import React from "react";
import LoginForm from "./components/Form";
import Providers from "./components/Providers";
const Login: React.FC = () => {
  return (
    <div className="flex flex-1 flex-col justify-center px-4 py-10 lg:px-6">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <div>
          <Logo alt="Logo" className="w-52 mx-auto" />
        </div>
        <h2 className="text-center text-xl font-semibold text-balance text-foreground">
          Log in or{" "}
          <Link to="/auth/sign-up" className="link">
            create account
          </Link>
        </h2>{" "}
        <p className="mt-4 text-xs text-pretty text-center text-muted-foreground dark:text-muted-foreground">
          By logging in, you agree to our{" "}
          <a href="#" className="underline underline-offset-4">
            terms of service
          </a>{" "}
          and{" "}
          <a href="#" className="underline underline-offset-4">
            privacy policy
          </a>
          .
        </p>
        <LoginForm />
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              or with
            </span>
          </div>
        </div>
        <Providers />
        <p className="mt-4 text-sm text-pretty text-center text-muted-foreground dark:text-muted-foreground">
          Forgot your password?{" "}
          <Link to="/auth/reset-password" className="link text-primary">
            Reset password
          </Link>
          .
        </p>
      </div>
    </div>
  );
};

export default Login;
