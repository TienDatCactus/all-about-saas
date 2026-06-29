import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import React from "react";
import AuthLayout from "../layouts/auth";
import SignUpForm from "./components/Form";
const SignUp: React.FC = () => {
  const navigate = useNavigate();
  return (
    <AuthLayout
      form={<SignUpForm />}
      title={{
        text: "Sign up for AAS account",
      }}
      action={{
        component: (
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
        ),
        text: "or ",
      }}
    />
  );
};

export default SignUp;
