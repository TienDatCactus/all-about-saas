import React from "react";
import AuthLayout from "../layouts/auth";
import LoginForm from "./components/Form";
import Providers from "./components/Providers";
const Login: React.FC = () => {
  return (
    <AuthLayout
      form={<LoginForm />}
      title={{
        text: "Log in or",
        link: "/auth/sign-up",
        anchor: "create account",
      }}
      legend={{
        text: "Forgot your password?",
        link: "/auth/reset-password",
        anchor: "Reset password",
      }}
      action={{
        component: <Providers />,
        text: "or with",
      }}
    />
  );
};

export default Login;
