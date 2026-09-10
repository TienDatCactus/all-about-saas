import React from "react"
import { useTranslation } from "react-i18next"
import AuthLayout from "../layouts/auth"
import ChangePasswordForm from "./components/Form"

const ChangePassword: React.FC = () => {
  const { t } = useTranslation()
  return (
    <AuthLayout
      form={<ChangePasswordForm />}
      title={{
        text: t("auth.changePassword.title"),
      }}
    />
  )
}

export default ChangePassword
