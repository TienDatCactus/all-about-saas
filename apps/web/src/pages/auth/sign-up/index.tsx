import { ArrowLeftIcon } from "@phosphor-icons/react"
import { useNavigate } from "@tanstack/react-router"
import React from "react"
import { useTranslation } from "react-i18next"
import AuthLayout from "../layouts/auth"
import SignUpForm from "./components/Form"
import { Button } from "@/components/ui/button"

const SignUp: React.FC = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  return (
    <AuthLayout
      form={<SignUpForm />}
      title={{
        text: t("auth.signUp.title"),
      }}
      action={{
        component: (
          <Button
            variant="outline"
            onClick={() => {
              void navigate({
                to: "/auth/login",
              })
            }}
            className="flex w-full items-center justify-center space-x-2 py-2"
          >
            <ArrowLeftIcon />
            <span className="text-sm font-medium">
              {t("auth.signUp.backToLogin")}
            </span>
          </Button>
        ),
        text: t("auth.signUp.or"),
      }}
    />
  )
}

export default SignUp
