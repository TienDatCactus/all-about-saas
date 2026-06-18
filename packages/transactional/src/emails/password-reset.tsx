import * as React from "react";
import EmailLayout from "./components/layout";
import { baseURL } from "./utils";
export interface PasswordResetEmailProps {
  companyName: string;
  url: string;
}

export const PasswordResetEmail = ({
  companyName = "All About SaaS",
  url = "https://example.com/",
}: PasswordResetEmailProps) => {
  return (
    <EmailLayout
      content={{
        title: "Reset your password",
        subtitle: `Someone requested a password reset for your ${companyName} account. Use the button below to choose a new password.`,
        legend:
          "If you didn't request this, please ignore this email. Your password won't change until you access the link above and create a new one.",
        brand: companyName,
        cta: {
          text: "Change password",
          url: url,
        },
      }}
      image={{
        type: "logo",
        src: `${baseURL}/logo/logo.png`,
        alt: "Logo",
        size: {
          width: 148,
          height: 111,
        },
      }}
    />
  );
};

PasswordResetEmail.PreviewProps = {
  companyName: "All About SaaS",
  url: "https://example.com/",
} satisfies PasswordResetEmailProps;

export default PasswordResetEmail;
