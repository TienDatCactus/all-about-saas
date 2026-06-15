import Email from "./emails/email";

import { render } from "@react-email/render";
import React, { Attributes } from "react";

export const emails = {
  welcome: Email,
};
export function renderTemplate<T>(
  template: keyof typeof emails,
  props: Attributes,
) {
  const EmailComponent = emails[template];

  return render(React.createElement(EmailComponent, props));
}
