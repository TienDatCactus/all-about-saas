import React from "react"
import { useTranslation } from "react-i18next"
import AuthLayout from "../layouts/auth"
import LoginForm from "./components/Form"
import Providers from "./components/Providers"

const Login: React.FC = () => {
  const { t } = useTranslation()
  return (
    <AuthLayout
      form={<LoginForm />}
      title={{
        text: t("auth.login.title"),
        link: "/auth/sign-up",
        anchor: t("auth.login.createAccount"),
      }}
      legend={{
        text: t("auth.login.forgotPassword"),
        link: "/auth/reset-password",
        anchor: t("auth.login.resetPasswordLink"),
      }}
      action={{
        component: <Providers />,
        text: t("auth.login.orWith"),
      }}
    />
  )
}

export default Login
