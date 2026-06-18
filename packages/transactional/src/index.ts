import Email from "./emails/welcome";
import PasswordResetEmail from "./emails/password-reset";

import { render } from "@react-email/render";
import React from "react";

export const emails = {
  welcome: Email,
  passwordReset: PasswordResetEmail,
};
export type EmailTemplate = keyof typeof emails;

export function renderTemplate(template: EmailTemplate, props?: any) {
  const EmailComponent = emails[template];

  return render(React.createElement(EmailComponent, props));
}
