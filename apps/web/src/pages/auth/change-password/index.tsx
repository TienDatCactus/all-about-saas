import React from "react";
import AuthLayout from "../layouts/auth";
import ChangePasswordForm from "./components/Form";

const ChangePassword: React.FC = () => {
  return (
    <AuthLayout
      form={<ChangePasswordForm />}
      title={{
        text: "Reset your password",
      }}
    />
  );
};

export default ChangePassword;
