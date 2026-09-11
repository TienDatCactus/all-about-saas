import * as React from "react";
import { Section, Text } from "@react-email/components";

export interface EmailListItem {
  title: string;
  description?: string;
}

/** Matte's product-update "here's what shipped" row list (title + optional
 *  description, bottom border per row) — reused here for any notification
 *  email whose content is a list of items rather than one paragraph. */
export default function EmailListSection({
  items,
}: {
  items: EmailListItem[];
}) {
  if (items.length === 0) return null;

  return (
    <Section className="mobile:px-6! px-10 pb-4">
      {items.map((item, idx) => (
        <Section key={idx} className="border-stroke border-b py-4">
          <Text className="font-15 font-inter text-fg m-0">{item.title}</Text>
          {item.description && (
            <Text className="font-13 font-inter text-fg-2 m-0 mt-1">
              {item.description}
            </Text>
          )}
        </Section>
      ))}
    </Section>
  );
}
