import Email from "./emails/email";

import { render } from "@react-email/render";
import React, { Attributes } from "react";

export const emails = {
  welcome: Email,
};
export type EmailTemplate = keyof typeof emails;

export function renderTemplate(template: EmailTemplate, props?: any) {
  const EmailComponent = emails[template];

  return render(React.createElement(EmailComponent, props));
}
