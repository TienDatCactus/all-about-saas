// Get the full source code, including the theme and Tailwind config:
// https://github.com/resend/react-email/tree/canary/apps/demo/emails

import { Body } from "react-email";
import EmailLayout from "./components/layout";
import { baseURL } from "./utils";

export interface WelcomeEmailProps {
  companyName?: string;
  url?: string;
}

export const WelcomeEmail = ({
  companyName = "All About SaaS",
  url = "https://example.com/",
}: WelcomeEmailProps) => {
  return (
    <EmailLayout
      content={{
        title: `Welcome to ${companyName}`,
        subtitle: `Thank you for signing up for ${companyName}`,
        legend:
          "You're all set—explore what's new and get your first project going.",
        brand: companyName,
        cta: {
          text: "Explore",
          url: url,
        },
      }}
      image={{
        type: "hero",
        src: `${baseURL}/logo/logo.png`,
        alt: "Welcome Hero",
        size: {
          width: 608,
          height: 342,
        },
      }}
    />
  );
};

WelcomeEmail.PreviewProps = {
  companyName: "All About SaaS",
  url: "https://example.com/",
} satisfies WelcomeEmailProps;

export default WelcomeEmail;
